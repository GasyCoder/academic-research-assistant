import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';

import {
  IntegrationError,
  LIMITS,
  crossrefLookupSchema,
  crossrefSearchSchema,
  openalexLookupSchema,
  openalexSearchSchema,
  providerResultSchema,
  safeError,
  valeInputSchema,
  zoteroGetSchema,
  zoteroSearchSchema,
} from './contracts.js';
import type { Integrations } from './service.js';
import { valeResultSchema } from './vale.js';
import { VERSION } from './version.js';

export const SERVER_NAME = 'research-integrations-mcp';
export const SERVER_VERSION = VERSION;

const INSTRUCTIONS =
  'Read-only research integrations, separate from LanguageTool. Metadata tools send a request only with ' +
  'networkConsent=true, set after an explicit verification request or an announced, authorized workflow; ' +
  'an ordinary review sends nothing. Send only an identifier or minimal bibliographic fields, never manuscript text. ' +
  'Each provider has its own status: not_found is not evidence that a work does not exist or is fabricated. ' +
  'Search results are candidates; keep ambiguity, dates, provenance and provider disagreements, and never pick a winner. ' +
  'Metadata alone cannot verify that a source supports a claim. vale_check is optional local style lint and never rewrites text.';

/** Serializes a result into structured content and its JSON text copy, bounded together. */
export function toolResult(value: Record<string, unknown>): CallToolResult {
  const result: CallToolResult = { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.resultBytes) {
    return toolError(new IntegrationError('RESPONSE_TOO_LARGE'));
  }
  return result;
}

export function toolError(error: unknown): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: safeError(error).details() }) }] };
}

type InputSchema =
  | typeof crossrefLookupSchema
  | typeof crossrefSearchSchema
  | typeof openalexLookupSchema
  | typeof openalexSearchSchema
  | typeof zoteroGetSchema
  | typeof zoteroSearchSchema
  | typeof valeInputSchema;

/** Builds the MCP server. Transport-agnostic; registering tools performs no I/O. */
export function createServer(service: Integrations): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  const register = (
    name: string,
    description: string,
    inputSchema: InputSchema,
    outputSchema: typeof providerResultSchema | typeof valeResultSchema,
    run: (input: unknown) => Promise<Record<string, unknown>>,
    openWorld: boolean,
  ): void => {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: openWorld },
      },
      async (args: unknown) => {
        try {
          return toolResult(await run(args));
        } catch (error) {
          return toolError(error);
        }
      },
    );
  };

  register(
    'crossref_lookup_doi',
    'Look up one DOI in the Crossref REST API v1 and return its record, provenance, separate DOI verification ' +
      'levels and optional local comparison with expected title/author/year. Requires networkConsent=true. ' +
      'An unrecognized DOI is not sent or corrected; not_found is not evidence of nonexistence.',
    crossrefLookupSchema,
    providerResultSchema,
    service.crossrefLookup,
    true,
  );
  register(
    'crossref_search_works',
    `Search Crossref works by title, with optional author and year (±1 year), returning at most ${LIMITS.results} ` +
      'candidates with comparison evidence and bounded offset paging. Never selects a candidate. Requires networkConsent=true.',
    crossrefSearchSchema,
    providerResultSchema,
    service.crossrefSearch,
    true,
  );
  register(
    'openalex_lookup_work',
    'Look up one OpenAlex work by W id or DOI, keeping the OpenAlex id and DOI as distinct identifiers, with ' +
      'provenance and optional local comparison. Requires networkConsent=true.',
    openalexLookupSchema,
    providerResultSchema,
    service.openalexLookup,
    true,
  );
  register(
    'openalex_search_works',
    `Search OpenAlex works by title (title-scoped search; author is compared locally, not sent), optional year (±1), ` +
      `at most ${LIMITS.results} candidates per page and ${LIMITS.maxPage} pages. Requires networkConsent=true.`,
    openalexSearchSchema,
    providerResultSchema,
    service.openalexSearch,
    true,
  );
  register(
    'zotero_get_item',
    'Read one item of a Zotero library (Web API v3, or the opt-in local Desktop API). Public libraries need no key; ' +
      'private web reads need an operator-configured key. Bibliographic fields only; no writes. Requires networkConsent=true.',
    zoteroGetSchema,
    providerResultSchema,
    service.zoteroGet,
    true,
  );
  register(
    'zotero_search_items',
    `Search one bounded page (at most ${LIMITS.results}) of top-level Zotero items by title, creator and year. ` +
      'No notes, abstracts or attachments; no writes. Requires networkConsent=true.',
    zoteroSearchSchema,
    providerResultSchema,
    service.zoteroSearch,
    true,
  );
  register(
    'vale_check',
    `Lint up to ${LIMITS.valeText} characters of supplied plain text or Markdown with the operator-configured local ` +
      'Vale executable and configuration. Returns Vale-native line/span diagnostics; never syncs, downloads or rewrites.',
    valeInputSchema,
    valeResultSchema,
    service.valeCheck,
    false,
  );
  return server;
}
