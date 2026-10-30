import { describe, expect, it } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { type FetchLike, LanguageToolClient } from '../src/languagetool-client.js';
import { segmentDocument } from '../src/segmentation.js';
import {
  type CheckDocumentInput,
  MAX_DOCUMENT_ISSUES,
  MAX_DOCUMENT_LENGTH,
  MAX_REPLACEMENTS_PER_ISSUE,
  checkDocumentInputSchema,
  runCheckDocument,
} from '../src/tools/check-document.js';
import { MAX_MCP_RESULT_BYTES, toolSuccess } from '../src/tools/results.js';
import { checkDocumentResultSchema } from '../src/types.js';
import { fakeCheckResponse, fakeLanguageToolFetch, tehOffsets } from './fake-languagetool.js';
import { TEST_BASE_URL } from './helpers.js';

/** Small requests so that short documents span several chunks: cores of at most 220 units. */
const SMALL = { maxTextLength: 300, contextLength: 40 };
const MARKER = 'UNPUBLISHED-DATASET-91';

function smallClient(fetch: FetchLike, timeoutMs = 1000): LanguageToolClient {
  return new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs, fetch, maxTextLength: SMALL.maxTextLength });
}

function input(text: string, extra: Partial<CheckDocumentInput> = {}): CheckDocumentInput {
  return { text, language: 'en-US', ...extra };
}

/** Paragraphs of filler sentences; `inserts` replace the filler of the given paragraphs. */
function documentOf(paragraphCount: number, inserts: Record<number, string> = {}): string {
  return Array.from(
    { length: paragraphCount },
    (_, index) => inserts[index] ?? `Paragraph ${index} reports the method. It was evaluated on several datasets.`,
  ).join('\n\n');
}

async function captureError(promise: Promise<unknown>): Promise<LanguageToolError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

describe('check_document offsets', () => {
  it('owns crossing ranges by their start, including zero-width boundary and EOF issues', async () => {
    const text = 'x'.repeat(1_000);
    const segments = segmentDocument(text, { maxRequestLength: SMALL.maxTextLength, contextLength: SMALL.contextLength });
    const boundary = segments[0]!.coreEnd;
    const expected = [
      { offset: boundary - 3, length: 8, ruleId: 'CROSS' },
      { offset: boundary, length: 0, ruleId: 'INSERT' },
      { offset: boundary, length: 1, ruleId: 'OTHER' },
      { offset: boundary + 5, length: 1, ruleId: 'RIGHT' },
      { offset: text.length, length: 0, ruleId: 'EOF' },
    ];
    let calls = 0;
    const fetch: FetchLike = async () => {
      const segment = segments[calls++]!;
      const raw = fakeCheckResponse('');
      return new Response(JSON.stringify({ ...raw, matches: expected
        .filter((issue) => issue.offset >= segment.start && issue.offset + issue.length <= segment.end)
        .map((issue) => ({
          message: 'Crossing range', offset: issue.offset - segment.start, length: issue.length,
          context: { text: 'x'.repeat(issue.length + 4), offset: 2, length: issue.length },
          rule: { id: issue.ruleId },
        })) }));
    };
    const result = await runCheckDocument(smallClient(fetch), input(text), {}, SMALL);
    expect(result.issues.map(({ offset, length, ruleId }) => ({ offset, length, ruleId }))).toEqual(expected);
    expect(result.issues.every((issue) => issue.context!.offset === 2)).toBe(true);
    expect(calls).toBe(segments.length);
  });

  it('does not promise monolithic completeness for a diagnostic longer than the overlap', async () => {
    const text = 'x'.repeat(1_000);
    const segments = segmentDocument(text, { maxRequestLength: SMALL.maxTextLength, contextLength: SMALL.contextLength });
    const offset = segments[0]!.coreEnd - 45;
    const length = 90;
    let calls = 0;
    const fetch: FetchLike = async () => {
      const segment = segments[calls++]!;
      return new Response(JSON.stringify({ ...fakeCheckResponse(''), matches:
        offset >= segment.start && offset + length <= segment.end
          ? [{ message: 'Long rule', offset: offset - segment.start, length, rule: { id: 'LONG' } }]
          : [],
      }));
    };
    const result = await runCheckDocument(smallClient(fetch), input(text), {}, SMALL);
    expect(result).toMatchObject({ complete: true, issueCount: 0, processedChunkCount: segments.length });
  });

  it('checks a document that fits in one request like check_text', async () => {
    const fake = fakeLanguageToolFetch();
    const text = 'One teh here. Another teh there.';
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    expect(fake.texts()).toEqual([text]);
    expect(result).toMatchObject({ complete: true, truncated: false, chunkCount: 1, processedChunkCount: 1 });
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    expect(checkDocumentResultSchema.safeParse(result).success).toBe(true);
  });

  it('maps the issues of the first, middle and last chunks to document offsets', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(30, { 0: 'teh first paragraph.', 15: 'A middle teh paragraph.', 29: 'The last one: teh' });
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    expect(result.chunkCount).toBeGreaterThan(3);
    expect(result.complete).toBe(true);
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    for (const issue of result.issues) {
      expect(text.slice(issue.offset, issue.offset + issue.length)).toBe('teh');
    }
  });

  it('keeps exact UTF-16 offsets after accents, emoji and astral characters', async () => {
    const fake = fakeLanguageToolFetch();
    const prefixes = ['é', '😀', '👩‍👩‍👧', '𝔘𝔫𝔦', 'naïve 😀😀', 'é'];
    const text = documentOf(36, Object.fromEntries(prefixes.map((prefix, index) => [index * 6 + 3, `${prefix} teh ${prefix}`])));
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    expect(result.chunkCount).toBeGreaterThan(3);
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    for (const issue of result.issues) {
      expect(text.slice(issue.offset, issue.offset + issue.length)).toBe('teh');
      // Context offsets stay relative to context.text.
      expect(issue.context!.text.slice(issue.context!.offset, issue.context!.offset + issue.context!.length)).toBe('teh');
    }
  });

  it('reports once an issue that two chunks see around an artificial cut', async () => {
    const fake = fakeLanguageToolFetch();
    // One long paragraph: every cut is a sentence cut with context, and every sentence has a "teh".
    const text = Array.from({ length: 40 }, (_, index) => `Sentence ${index} has teh word.`).join(' ');
    const segments = segmentDocument(text, { maxRequestLength: SMALL.maxTextLength, contextLength: SMALL.contextLength }, 'en-US');
    expect(segments.some((segment) => segment.start < segment.coreStart)).toBe(true);

    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    const sentCount = fake.texts().reduce((count, chunk) => count + tehOffsets(chunk).length, 0);
    expect(sentCount).toBeGreaterThan(tehOffsets(text).length);
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
  });

  it('reports an issue right at either side of a cut', async () => {
    const fake = fakeLanguageToolFetch();
    const base = documentOf(12);
    const cut = segmentDocument(base, { maxRequestLength: SMALL.maxTextLength, contextLength: SMALL.contextLength })[1]!.coreStart;
    // "teh" ends the paragraph before the cut and starts the one after it.
    const text = `${base.slice(0, cut - 2)} teh${base.slice(cut - 2, cut)}teh ${base.slice(cut)}`;
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
  });

  it('keeps different issues reported at the same offset', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(10, { 6: 'A DOUBLE problem here.' });
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    const offset = text.indexOf('DOUBLE');
    expect(result.issues.filter((issue) => issue.offset === offset).map((issue) => issue.ruleId)).toEqual([
      'FAKE_RULE_A',
      'FAKE_RULE_B',
    ]);
  });
});

describe('check_document requests', () => {
  it('sends no additional chunk when cancellation happens during an HTTP request', async () => {
    const fake = fakeLanguageToolFetch();
    const controller = new AbortController();
    const fetch: FetchLike = async (url, init) => {
      controller.abort();
      return fake.fetch(url, init);
    };
    await expect(runCheckDocument(smallClient(fetch), input(documentOf(10)), { signal: controller.signal }, SMALL)).rejects.toThrow();
    expect(fake.state.requests).toHaveLength(1);
  });

  it('sends the language and options with every chunk', async () => {
    const fake = fakeLanguageToolFetch();
    await runCheckDocument(
      smallClient(fake.fetch),
      input(documentOf(10), { language: 'fr', level: 'picky', disabledRules: ['R1'], disabledCategories: ['C1'] }),
      {},
      SMALL,
    );

    expect(fake.state.requests.length).toBeGreaterThan(1);
    for (const params of fake.state.requests) {
      expect(params.get('language')).toBe('fr');
      expect(params.get('level')).toBe('picky');
      expect(params.get('disabledRules')).toBe('R1');
      expect(params.get('disabledCategories')).toBe('C1');
    }
  });

  it('sends the chunks one at a time, each exactly once', async () => {
    const fake = fakeLanguageToolFetch({ delayMs: 5 });
    const result = await runCheckDocument(smallClient(fake.fetch), input(documentOf(20)), {}, SMALL);

    expect(fake.state.maxInFlight).toBe(1);
    expect(fake.state.requests).toHaveLength(result.chunkCount);
    for (const chunk of fake.texts()) {
      expect(chunk.length).toBeLessThanOrEqual(SMALL.maxTextLength);
    }
  });

  it('reports progress after each chunk', async () => {
    const fake = fakeLanguageToolFetch();
    const calls: Array<[number, number]> = [];
    const result = await runCheckDocument(
      smallClient(fake.fetch),
      input(documentOf(10)),
      { onProgress: (progress, total) => void calls.push([progress, total]) },
      SMALL,
    );

    expect(calls).toEqual(Array.from({ length: result.chunkCount }, (_, index) => [index + 1, result.chunkCount]));
  });

  it('stops sending chunks once the request is cancelled', async () => {
    const fake = fakeLanguageToolFetch();
    const controller = new AbortController();
    const outcome = runCheckDocument(
      smallClient(fake.fetch),
      input(documentOf(10)),
      { signal: controller.signal, onProgress: () => controller.abort() },
      SMALL,
    );

    await expect(outcome).rejects.toThrow();
    expect(fake.state.requests).toHaveLength(1);
  });
});

describe('check_document partial failures', () => {
  it.each(['invalid JSON', '{}'])('stops after consecutive incompatible responses: %s', async (body) => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls++;
      return new Response(body);
    };
    const error = await captureError(runCheckDocument(smallClient(fetch), input(documentOf(30)), {}, SMALL));
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(calls).toBe(2);
    expect(JSON.stringify(error.toDetails())).not.toContain(MARKER);
  });

  it('keeps previous results and skips later chunks after consecutive invalid responses', async () => {
    const fake = fakeLanguageToolFetch();
    let calls = 0;
    const fetch: FetchLike = async (url, init) => ++calls === 1 ? fake.fetch(url, init) : new Response('invalid JSON');
    const result = await runCheckDocument(smallClient(fetch), input(documentOf(30, { 0: 'teh start.' })), {}, SMALL);
    expect(calls).toBe(3);
    expect(result).toMatchObject({ complete: false, processedChunkCount: 1, failedChunkCount: 2 });
    expect(result.failedRanges.slice(0, 2).map((range) => range.code)).toEqual(['INVALID_RESPONSE', 'INVALID_RESPONSE']);
    expect(result.failedRanges.slice(2).every((range) => range.code === 'SKIPPED')).toBe(true);
    expect(result.issueCount).toBe(1);
    for (const range of result.failedRanges) expect(Object.keys(range).sort()).toEqual(['chunkIndex', 'code', 'end', 'start']);
  });

  it('resets the invalid-response streak after a successful chunk', async () => {
    const fake = fakeLanguageToolFetch();
    let calls = 0;
    const fetch: FetchLike = async (url, init) => ++calls % 2 === 1 ? new Response('invalid JSON') : fake.fetch(url, init);
    const result = await runCheckDocument(smallClient(fetch), input(documentOf(30)), {}, SMALL);
    expect(calls).toBe(result.chunkCount);
    expect(result.skippedChunkCount).toBe(0);
    expect(result.failedChunkCount).toBe(Math.ceil(result.chunkCount / 2));
  });

  it('continues after an invalid answer and reports the failed range', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(30, { 2: 'teh start.', 15: `BADJSON ${MARKER} teh`, 28: 'teh end.' });
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL);

    const failed = result.failedRanges;
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(failed[0]!.start).toBeLessThanOrEqual(text.indexOf('BADJSON'));
    expect(failed[0]!.end).toBeGreaterThan(text.indexOf('BADJSON'));
    expect(result).toMatchObject({ complete: false, truncated: false, failedChunkCount: 1, skippedChunkCount: 0 });
    expect(result.processedChunkCount).toBe(result.chunkCount - 1);
    expect(fake.state.requests).toHaveLength(result.chunkCount);
    // Issues of every other chunk are kept; the failed chunk contributes none.
    const expected = tehOffsets(text).filter((offset) => offset < failed[0]!.start || offset >= failed[0]!.end);
    expect(result.issues.map((issue) => issue.offset)).toEqual(expected);
    expect(JSON.stringify(result.failedRanges)).not.toContain(MARKER);
  });

  it.each([
    ['TIMEOUT', 'HANG'],
    ['HTTP_ERROR', 'FAIL500'],
    ['UNREACHABLE', 'REFUSED'],
  ])('stops after %s and lists the remaining chunks as skipped', async (code, trigger) => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(30, { 2: 'teh start.', 15: `${trigger} ${MARKER}`, 28: 'teh end.' });
    const result = await runCheckDocument(smallClient(fake.fetch, 50), input(text), {}, SMALL);

    const failedIndex = result.failedRanges[0]!.chunkIndex;
    expect(result.failedRanges[0]).toMatchObject({ code });
    expect(result.failedRanges.slice(1).map((range) => range.code)).toEqual(
      Array(result.chunkCount - failedIndex - 1).fill('SKIPPED'),
    );
    expect(result.failedRanges.at(-1)!.end).toBe(text.length);
    expect(result).toMatchObject({ complete: false, failedChunkCount: 1, processedChunkCount: failedIndex });
    expect(result.skippedChunkCount).toBe(result.chunkCount - failedIndex - 1);
    // At most one POST per chunk, and nothing after the failure.
    expect(fake.state.requests).toHaveLength(failedIndex + 1);
    expect(result.issues.map((issue) => issue.offset)).toEqual([text.indexOf('teh start')]);
    expect(JSON.stringify(result)).not.toContain(MARKER);
  });

  it('returns the first error as the tool error when no chunk could be checked', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(10, { 0: `REFUSED ${MARKER}` });
    const error = await captureError(runCheckDocument(smallClient(fake.fetch), input(text), {}, SMALL));

    expect(error.code).toBe('UNREACHABLE');
    expect(fake.state.requests).toHaveLength(1);
    expect(JSON.stringify(error.toDetails())).not.toContain(MARKER);
  });

  it('fails a chunk whose issue ranges fall outside the checked text', async () => {
    const fake = fakeLanguageToolFetch();
    const client = smallClient(fake.fetch);
    const check = client.check.bind(client);
    client.check = async (request) => {
      const raw = await check(request);
      // Bypasses the client's own validation, as a defect elsewhere would.
      return request.text.includes('Paragraph 5 ')
        ? { ...raw, matches: [{ message: 'm', offset: request.text.length, length: 4, rule: { id: 'R' } }] }
        : raw;
    };
    const text = documentOf(12);
    const result = await runCheckDocument(client, input(text), {}, SMALL);

    expect(result.failedRanges).toEqual([expect.objectContaining({ code: 'INVALID_RESPONSE' })]);
    expect(result.processedChunkCount).toBe(result.chunkCount - 1);
  });
});

describe('check_document output budget', () => {
  it('may keep an earlier rule at truncatedAt when two diagnostics share an offset', async () => {
    const fake = fakeLanguageToolFetch();
    const result = await runCheckDocument(smallClient(fake.fetch), input('DOUBLE'), {}, { ...SMALL, maxIssues: 1 });
    expect(result).toMatchObject({ truncated: true, truncatedAt: 0, complete: false, issueCount: 1, processedChunkCount: 1 });
    expect(result.issues[0]).toMatchObject({ offset: 0, ruleId: 'FAKE_RULE_A' });
  });

  it('propagates the upstream incomplete-results warning without calling it budget truncation', async () => {
    const fetch: FetchLike = async () => new Response(JSON.stringify({ ...fakeCheckResponse(''), warnings: { incompleteResults: true } }));
    const result = await runCheckDocument(smallClient(fetch), input('text'), {}, SMALL);
    expect(result).toMatchObject({ complete: false, truncated: false, truncatedAt: null, incompleteResults: true });
  });

  it('returns at most MAX_DOCUMENT_ISSUES issues and says where it stopped', async () => {
    const fake = fakeLanguageToolFetch();
    const text = 'teh '.repeat(5_000);
    const result = await runCheckDocument(
      new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs: 5000, fetch: fake.fetch }),
      input(text),
    );

    expect(result.issueCount).toBe(MAX_DOCUMENT_ISSUES);
    expect(result).toMatchObject({ truncated: true, truncatedAt: 4 * MAX_DOCUMENT_ISSUES, complete: false });
    expect(result.issues.at(-1)!.offset).toBeLessThan(result.truncatedAt!);
  });

  it('stops at the byte budget and checks no further chunk', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(30, { 1: 'teh teh teh teh', 3: 'teh teh teh teh', 20: 'teh never reached' });
    const result = await runCheckDocument(smallClient(fake.fetch), input(text), {}, { ...SMALL, maxIssueBytes: 4_000 });

    const offsets = tehOffsets(text);
    expect(result.truncated).toBe(true);
    expect(result.issues.map((issue) => issue.offset)).toEqual(offsets.slice(0, result.issueCount));
    expect(result.truncatedAt).toBe(offsets[result.issueCount]);
    expect(result.failedRanges.every((range) => range.code === 'SKIPPED')).toBe(true);
    expect(result.processedChunkCount + result.skippedChunkCount).toBe(result.chunkCount);
    expect(fake.state.requests).toHaveLength(result.processedChunkCount);
  });

  it('keeps the serialized result well within the MCP result limit for oversized issues', async () => {
    // About 950 issues of 3 KB messages per chunk: the byte budget, not the count, stops accumulation.
    const fake = fakeLanguageToolFetch({ messageLength: 3_000 });
    const text = 'A sentence with one teh in it, and more words. '.repeat(3_000).slice(0, MAX_DOCUMENT_LENGTH);
    const result = await runCheckDocument(
      new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs: 5000, fetch: fake.fetch }),
      input(text),
    );

    expect(result.truncated).toBe(true);
    expect(result.issueCount).toBeLessThan(MAX_DOCUMENT_ISSUES);
    const toolResult = toolSuccess(result);
    expect(toolResult.isError).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(toolResult))).toBeLessThan(MAX_MCP_RESULT_BYTES * 0.6);
  });

  it('returns at most MAX_REPLACEMENTS_PER_ISSUE replacements and flags the cut', async () => {
    const fake = fakeLanguageToolFetch();
    const result = await runCheckDocument(smallClient(fake.fetch), input('A MANYREPS issue and a teh issue.'), {}, SMALL);

    const [many, single] = result.issues;
    expect(many!.replacements).toEqual(['rep0', 'rep1', 'rep2', 'rep3', 'rep4']);
    expect(many!.replacements).toHaveLength(MAX_REPLACEMENTS_PER_ISSUE);
    expect(many!.replacementsTruncated).toBe(true);
    expect(single).toMatchObject({ replacements: ['the'], replacementsTruncated: false });
    expect(result.complete).toBe(true);
  });
});

describe('check_document length limit', () => {
  it('counts astral characters in UTF-16 units and rejects 100,001 before HTTP', async () => {
    const fake = fakeLanguageToolFetch();
    const client = new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs: 5000, fetch: fake.fetch });
    const text = '😀'.repeat(50_000);
    const result = await runCheckDocument(client, input(text));
    expect(result).toMatchObject({ complete: true, documentLength: 100_000 });
    expect(fake.texts().every((chunk) => chunk.length <= 50_000 && chunk.length % 2 === 0)).toBe(true);
    const calls = fake.state.requests.length;
    const error = await captureError(runCheckDocument(client, input(`${text}x`)));
    expect(error.code).toBe('TEXT_TOO_LONG');
    expect(fake.state.requests).toHaveLength(calls);
    expect(JSON.stringify(error.toDetails())).not.toContain('😀');
  });

  it('advertises the limit in its input schema', () => {
    expect(MAX_DOCUMENT_LENGTH).toBe(100_000);
    expect(MAX_DOCUMENT_ISSUES).toBe(1_650);
    expect(checkDocumentInputSchema.safeParse(input('x'.repeat(MAX_DOCUMENT_LENGTH + 1))).success).toBe(true);
    expect(checkDocumentInputSchema.safeParse(input('   ')).success).toBe(false);
  });

  it('checks a document of exactly the limit', async () => {
    const fake = fakeLanguageToolFetch();
    const text = documentOf(2_200).slice(0, MAX_DOCUMENT_LENGTH);
    expect(text).toHaveLength(MAX_DOCUMENT_LENGTH);
    const result = await runCheckDocument(new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs: 5000, fetch: fake.fetch }), input(text));

    expect(result).toMatchObject({ complete: true, documentLength: MAX_DOCUMENT_LENGTH });
    expect(result.chunkCount).toBe(3);
  });

  it('rejects a longer document with TEXT_TOO_LONG before any request', async () => {
    const fake = fakeLanguageToolFetch();
    const text = `${MARKER} ${documentOf(2_200)}`.slice(0, MAX_DOCUMENT_LENGTH + 1);
    const error = await captureError(
      runCheckDocument(new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs: 5000, fetch: fake.fetch }), input(text)),
    );

    expect(fake.state.requests).toHaveLength(0);
    expect(error.toDetails()).toEqual({
      code: 'TEXT_TOO_LONG',
      message:
        `Document has ${MAX_DOCUMENT_LENGTH + 1} characters (UTF-16 code units), above the ${MAX_DOCUMENT_LENGTH}-character ` +
        'limit of check_document; split it and check the parts separately',
      endpoint: '/v2/check',
      httpStatus: null,
    });
  });
});
