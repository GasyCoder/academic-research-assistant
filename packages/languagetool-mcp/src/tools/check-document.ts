import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { LanguageToolError } from '../errors.js';
import { DEFAULT_MAX_TEXT_LENGTH, type LanguageToolClient } from '../languagetool-client.js';
import type { RawCheckResponse } from '../languagetool-schemas.js';
import { type Segment, segmentDocument } from '../segmentation.js';
import { toDocumentIssue, toSoftwareInfo } from '../transform.js';
import {
  type CheckDocumentResult,
  type DocumentIssue,
  type FailedRange,
  type SoftwareInfo,
  checkDocumentResultSchema,
} from '../types.js';
import { checkOptionsShape, textInputSchema } from './check-options.js';
import { MAX_MCP_RESULT_BYTES, toolFailure, toolSuccess } from './results.js';

/*
 * Values measured on LanguageTool 6.9-SNAPSHOT (12-core machine) with generic academic prose;
 * see the package README. Each chunk is one request of at most the client's text limit.
 */

/**
 * Longest document accepted, in UTF-16 code units: three check_text requests, about 22,000 words.
 * French, the slowest language measured, took about 7 s per 48,000-unit chunk on a warm server:
 * about 25 s for a document at the limit, 35 s when the language is cold.
 */
export const MAX_DOCUMENT_LENGTH = 3 * DEFAULT_MAX_TEXT_LENGTH;

/** Text sent on each side of an artificial cut: several whole sentences of prose. */
export const DOCUMENT_CONTEXT_LENGTH = 1_000;

/**
 * Issues returned at most: three times the densest rate measured (5.5 per 1,000 units, French,
 * picky level) over a document at the limit.
 */
export const MAX_DOCUMENT_ISSUES = 2_500;

/**
 * Serialized size of the returned issues, counting both copies made by toolSuccess. Enough for
 * MAX_DOCUMENT_ISSUES issues of the 95th-percentile measured size (about 1.7 KB), so the count is
 * the usual limit; half of MAX_MCP_RESULT_BYTES, leaving the rest of the result far below it.
 */
export const MAX_DOCUMENT_ISSUE_BYTES = MAX_MCP_RESULT_BYTES / 2;

/**
 * Replacements returned per issue. Only spelling rules exceeded it in the measured texts
 * (5 issues in 1,532), with up to 151 low-ranked suggestions.
 */
export const MAX_REPLACEMENTS_PER_ISSUE = 5;

export interface DocumentLimits {
  maxDocumentLength: number;
  contextLength: number;
  maxIssues: number;
  maxIssueBytes: number;
  maxReplacements: number;
}

const DEFAULT_DOCUMENT_LIMITS: DocumentLimits = {
  maxDocumentLength: MAX_DOCUMENT_LENGTH,
  contextLength: DOCUMENT_CONTEXT_LENGTH,
  maxIssues: MAX_DOCUMENT_ISSUES,
  maxIssueBytes: MAX_DOCUMENT_ISSUE_BYTES,
  maxReplacements: MAX_REPLACEMENTS_PER_ISSUE,
};

export interface DocumentCheckContext {
  /** Aborted when the caller cancels: no further chunk is sent. */
  signal?: AbortSignal;
  /** Called after each attempted chunk. */
  onProgress?: (progress: number, total: number) => void | Promise<void>;
}

export const checkDocumentInputSchema = z.object({
  // runCheckDocument enforces the length limit.
  text: textInputSchema(
    MAX_DOCUMENT_LENGTH,
    `Document to analyse, at most ${MAX_DOCUMENT_LENGTH} characters (UTF-16 code units); a longer document is ` +
      'rejected with TEXT_TOO_LONG, never truncated. It is sent unchanged to LanguageTool, part by part, and is never rewritten.',
  ),
  ...checkOptionsShape,
});

export type CheckDocumentInput = z.infer<typeof checkDocumentInputSchema>;

/**
 * Checks a document chunk by chunk, sequentially, and returns its issues in document coordinates.
 * Each chunk is sent at most once. A chunk whose answer is invalid is reported in failedRanges and
 * the next chunks are still checked; any other failure (timeout, unreachable server, HTTP error)
 * would repeat or add load, so the remaining chunks are skipped. If no chunk could be checked, the
 * first error is thrown. Issues are accumulated in document order until the output budget is
 * reached; processing then stops and the result says where.
 *
 * `limits` overrides the defaults for tests; the request size is the client's text limit.
 */
export async function runCheckDocument(
  client: LanguageToolClient,
  input: CheckDocumentInput,
  context: DocumentCheckContext = {},
  limits: Partial<DocumentLimits> = {},
): Promise<CheckDocumentResult> {
  const { maxDocumentLength, contextLength, maxIssues, maxIssueBytes, maxReplacements } = {
    ...DEFAULT_DOCUMENT_LIMITS,
    ...limits,
  };
  const { text, ...options } = input;
  if (text.length > maxDocumentLength) {
    // The length is reported, never the content.
    throw new LanguageToolError(
      'TEXT_TOO_LONG',
      `Document has ${text.length} characters (UTF-16 code units), above the ${maxDocumentLength}-character limit ` +
        'of check_document; split it and check the parts separately',
      { endpoint: '/v2/check' },
    );
  }

  const segments = segmentDocument(text, { maxRequestLength: client.maxTextLength, contextLength }, input.language);
  const issues: DocumentIssue[] = [];
  const failedRanges: FailedRange[] = [];
  const languages = new Map<string, { name: string; code: string }>();
  let software: SoftwareInfo | undefined;
  let firstError: LanguageToolError | undefined;
  let incompleteResults = false;
  let issueBytes = 0;
  let truncatedAt: number | null = null;
  let processed = 0;
  let failed = 0;
  let stopped = false;

  for (const segment of segments) {
    if (stopped) {
      failedRanges.push(rangeOf(segment, 'SKIPPED'));
      continue;
    }
    context.signal?.throwIfAborted();

    let raw: RawCheckResponse;
    let owned: DocumentIssue[];
    try {
      raw = await client.check({ ...options, text: text.slice(segment.start, segment.end) });
      owned = ownedIssues(raw, segment, text.length, maxReplacements);
    } catch (error) {
      if (!(error instanceof LanguageToolError)) {
        throw error;
      }
      firstError ??= error;
      failed++;
      failedRanges.push(rangeOf(segment, error.code));
      stopped = error.code !== 'INVALID_RESPONSE';
      await context.onProgress?.(segment.index + 1, segments.length);
      continue;
    }

    processed++;
    software ??= toSoftwareInfo(raw.software);
    languages.set(raw.language.code, { name: raw.language.name, code: raw.language.code });
    incompleteResults ||= raw.warnings?.incompleteResults === true;
    for (const issue of owned) {
      const cost = serializedCost(issue);
      if (issues.length >= maxIssues || issueBytes + cost > maxIssueBytes) {
        truncatedAt = issue.offset;
        stopped = true;
        break;
      }
      issues.push(issue);
      issueBytes += cost;
    }
    await context.onProgress?.(segment.index + 1, segments.length);
  }

  if (software === undefined) {
    // No chunk was checked: the first chunk is always attempted, so its failure is known.
    throw firstError!;
  }
  return {
    requestedLanguage: input.language,
    languages: [...languages.values()],
    software,
    documentLength: text.length,
    complete: failedRanges.length === 0 && truncatedAt === null && !incompleteResults,
    truncated: truncatedAt !== null,
    truncatedAt,
    incompleteResults,
    chunkCount: segments.length,
    processedChunkCount: processed,
    failedChunkCount: failed,
    skippedChunkCount: segments.length - processed - failed,
    failedRanges,
    issueCount: issues.length,
    issues,
  };
}

/**
 * The chunk's issues starting in its core, in document coordinates and order. Issues starting in
 * the context belong to the neighbouring chunk, which reports them with its own context: no issue
 * is reported twice, and two different issues at one offset are both kept.
 */
function ownedIssues(raw: RawCheckResponse, segment: Segment, documentLength: number, maxReplacements: number): DocumentIssue[] {
  const owned: DocumentIssue[] = [];
  for (const match of raw.matches) {
    const issue = toDocumentIssue(match, segment.start, maxReplacements);
    // The client checked ranges against the chunk; this guards the mapping to the document.
    if (issue.offset < segment.start || issue.offset + issue.length > Math.min(segment.end, documentLength)) {
      throw new LanguageToolError('INVALID_RESPONSE', 'LanguageTool returned an issue range outside the checked text', {
        endpoint: '/v2/check',
      });
    }
    const atDocumentEnd = issue.offset === documentLength && segment.coreEnd === documentLength;
    if ((issue.offset >= segment.coreStart && issue.offset < segment.coreEnd) || atDocumentEnd) {
      owned.push(issue);
    }
  }
  return owned.sort((a, b) => a.offset - b.offset);
}

/** Bytes an issue adds to the tool result: its JSON in structuredContent, and escaped again in the text content. */
function serializedCost(issue: DocumentIssue): number {
  const json = JSON.stringify(issue);
  return Buffer.byteLength(json) + Buffer.byteLength(JSON.stringify(json));
}

function rangeOf(segment: Segment, code: FailedRange['code']): FailedRange {
  return { chunkIndex: segment.index, start: segment.coreStart, end: segment.coreEnd, code };
}

export function registerCheckDocumentTool(server: McpServer, client: LanguageToolClient): void {
  server.registerTool(
    'check_document',
    {
      title: 'LanguageTool document check',
      description:
        `Analyse a document longer than check_text accepts (up to ${MAX_DOCUMENT_LENGTH} characters) with LanguageTool. ` +
        'It is split at paragraph or sentence boundaries and checked part by part, one request at a time; issue offsets ' +
        '(UTF-16 code units) refer to the whole document. The result is bounded: at most ' +
        `${MAX_DOCUMENT_ISSUES} issues and ${MAX_REPLACEMENTS_PER_ISSUE} replacements per issue. Unless \`complete\` is true, ` +
        'diagnostics are missing: see `truncated`, `truncatedAt` and `failedRanges`. Sends progress notifications when ' +
        'the request has a progress token. Like check_text, it never rewrites the text.',
      inputSchema: checkDocumentInputSchema,
      outputSchema: checkDocumentResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) => {
      const progressToken = ctx.mcpReq._meta?.progressToken;
      const onProgress =
        progressToken === undefined
          ? undefined
          : (progress: number, total: number) =>
              // A lost progress notification must not fail the check.
              ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken, progress, total } }).catch(() => undefined);
      try {
        return toolSuccess(await runCheckDocument(client, input, { signal: ctx.mcpReq.signal, onProgress }));
      } catch (error) {
        // After a cancellation the SDK sends nothing back.
        return toolFailure(error);
      }
    },
  );
}
