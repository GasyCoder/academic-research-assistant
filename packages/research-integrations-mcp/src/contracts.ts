/*
 * Shared contracts of the research integrations: limits, statuses, errors, tool input schemas and
 * the normalized result model. No I/O happens here.
 */
import { z } from 'zod';

export const LIMITS = Object.freeze({
  /** Largest provider response body read into memory, in bytes (configurable down/up to 8 MiB). */
  responseBytes: 2 * 1024 * 1024,
  /** Largest serialized tool result, in bytes, counted on the whole MCP envelope. */
  resultBytes: 512 * 1024,
  /** Public metadata responses kept in the in-memory cache. */
  cacheEntries: 32,
  /** Candidates returned by one search call. */
  results: 20,
  /** Authors retained per record; more are reported as AUTHORS_TRUNCATED. */
  authors: 100,
  /** Longest metadata string accepted from a provider, in UTF-16 code units. */
  metadataText: 2000,
  /** Longest query field accepted from a caller. */
  queryText: 500,
  /** Search offsets/pages beyond which a provider stops paging or the tool refuses. */
  maxStart: 10_000,
  maxPage: 10,
  /** Text sent to Vale in one call, in UTF-16 code units. */
  valeText: 40_000,
  diagnostics: 200,
  /** Combined stdout and stderr accepted from the Vale process. */
  processBytes: 512 * 1024,
});

export const providerSchema = z.enum(['crossref', 'openalex', 'zotero']);
export type Provider = z.infer<typeof providerSchema>;

/**
 * Outcome of one provider call. Each provider has its own status: a failure of one provider never
 * changes the status of another. `not_found` means only that this provider returned no matching
 * record for this query; it is never evidence that a work does not exist.
 */
export const statusSchema = z.enum([
  'exact_match',
  'candidate_match',
  'ambiguous',
  'metadata_mismatch',
  'not_found',
  'unavailable',
  'rate_limited',
  'authentication_required',
  'verification_not_performed',
]);
export type Status = z.infer<typeof statusSchema>;

const MESSAGES = {
  INVALID_INPUT: 'Invalid integration input',
  CONFIGURATION_ERROR: 'Invalid integration configuration',
  NETWORK_CONSENT_REQUIRED: 'Explicit network consent is required for this call',
  DOI_NOT_RECOGNIZED: 'The supplied value is not recognized as a DOI; no request was made',
  LOCAL_ZOTERO_DISABLED: 'Local Zotero access is not enabled',
  AUTHENTICATION_REQUIRED: 'Provider authentication or library permission is required',
  NOT_FOUND: 'No matching provider record was found for this query',
  RATE_LIMITED: 'Provider rate limit encountered; wait before another request',
  CLIENT_COOLDOWN: 'Client cooldown is active; wait before another request',
  BUSY: 'Too many requests to this provider are already waiting',
  HTTP_ERROR: 'Provider returned an unsuccessful HTTP status',
  UNAVAILABLE: 'Provider could not be reached',
  TIMEOUT: 'Integration request timed out',
  REDIRECT_BLOCKED: 'Provider redirect was not followed',
  RESPONSE_TOO_LARGE: 'Integration response exceeds the configured limit',
  INVALID_RESPONSE: 'Provider returned an unsupported response',
  VALE_UNAVAILABLE: 'Vale is not configured or its executable or configuration is unavailable',
  VALE_FAILURE: 'Vale could not complete the check',
  INTERNAL_ERROR: 'Unexpected integration failure',
} as const;
export type ErrorCode = keyof typeof MESSAGES;

/**
 * Every failure is an IntegrationError with a fixed message: never an upstream body, a URL, a
 * credential or a caller-supplied value.
 */
export class IntegrationError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus?: number,
    readonly retryAfterMs?: number,
    /** When a provider response was received, if one was. */
    readonly receivedAt?: string,
  ) {
    super(MESSAGES[code]);
    this.name = 'IntegrationError';
  }

  details(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      ...(this.httpStatus === undefined ? {} : { httpStatus: this.httpStatus }),
      ...(this.retryAfterMs === undefined ? {} : { retryAfterMs: this.retryAfterMs }),
    };
  }
}

export function safeError(error: unknown): IntegrationError {
  return error instanceof IntegrationError ? error : new IntegrationError('INTERNAL_ERROR');
}

/** Validates a tool input. The error never quotes the rejected value. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new IntegrationError('INVALID_INPUT');
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------------------------
// Tool inputs. Strict: there is no parameter for a URL, header, credential, executable or file.

const queryText = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.queryText)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
const year = z.number().int().min(1000).max(3000);
/**
 * Explicit opt-in for one call that sends minimal bibliographic fields to a provider. Defaults to
 * false: the caller sets it only after an explicit verification request or an announced workflow.
 */
const networkConsent = z.boolean().default(false);

/** Values from the document, compared locally with each returned record. Never sent upstream. */
export const expectedSchema = z
  .object({ doi: queryText.optional(), title: queryText.optional(), author: queryText.optional(), year: year.optional() })
  .strict();
export type Expected = z.infer<typeof expectedSchema>;

export const crossrefLookupSchema = z
  .object({ doi: queryText, expected: expectedSchema.optional(), networkConsent })
  .strict();
export const openalexLookupSchema = z
  .object({ id: queryText, expected: expectedSchema.optional(), networkConsent })
  .strict();

const searchShape = {
  title: queryText,
  author: queryText.optional(),
  year: year.optional(),
  limit: z.number().int().min(1).max(LIMITS.results).default(5),
  networkConsent,
};
export const crossrefSearchSchema = z
  .object({ ...searchShape, start: z.number().int().min(0).max(LIMITS.maxStart).default(0) })
  .strict();
export const openalexSearchSchema = z
  .object({ ...searchShape, page: z.number().int().min(1).max(LIMITS.maxPage).default(1) })
  .strict();

const libraryShape = {
  libraryType: z.enum(['users', 'groups']),
  /** Numeric Zotero library id (not a username). 0 is accepted by the local API for "my library". */
  libraryId: z.string().regex(/^(?:0|[1-9]\d{0,11})$/u),
  access: z.enum(['public', 'private']).default('public'),
  mode: z.enum(['web', 'local']).default('web'),
  networkConsent,
};
export const zoteroGetSchema = z
  .object({ ...libraryShape, itemKey: z.string().regex(/^[A-Z0-9]{8}$/u) })
  .strict();
export const zoteroSearchSchema = z
  .object({
    ...libraryShape,
    query: queryText,
    limit: z.number().int().min(1).max(LIMITS.results).default(5),
    start: z.number().int().min(0).max(LIMITS.maxStart).default(0),
  })
  .strict();

export const valeInputSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(LIMITS.valeText)
      .refine((value) => value.trim().length > 0),
    /** How Vale parses the text: plain prose, or Markdown markup. */
    format: z.enum(['text', 'markdown']).default('text'),
  })
  .strict();

// ---------------------------------------------------------------------------------------------
// Normalized results. Absent values stay absent; original provider strings are not rewritten.

const authorSchema = z
  .object({
    name: z.string().optional(),
    given: z.string().optional(),
    family: z.string().optional(),
    orcid: z.string().optional(),
    role: z.string().optional(),
  })
  .strict();

export const metadataSchema = z
  .object({
    provider: providerSchema,
    providerRecordId: z.string(),
    /** Lower-cased DOI, for comparison; the provider's original form stays in identifiers.doi. */
    doi: z.string().optional(),
    title: z.string().optional(),
    authors: z.array(authorSchema).optional(),
    year: z.number().int().optional(),
    /** Which retained date the year comes from; other dates may give other years. */
    yearSource: z.string().optional(),
    dates: z.record(z.string(), z.string()).optional(),
    container: z.string().optional(),
    volume: z.string().optional(),
    issue: z.string().optional(),
    pages: z.string().optional(),
    articleNumber: z.string().optional(),
    type: z.string().optional(),
    /** Descriptive only: never fetched by this package. */
    url: z.string().optional(),
    identifiers: z.record(z.string(), z.string()).optional(),
    /**
     * Explicit provider flags, e.g. `openalex.is_retracted`, exposed as provider statements only:
     * no universal retraction check, and `false` does not certify anything.
     */
    providerFlags: z.record(z.string(), z.boolean()).optional(),
    omissions: z.array(z.string()).optional(),
  })
  .strict();
export type Metadata = z.infer<typeof metadataSchema>;

export const comparisonSchema = z
  .object({
    field: z.enum(['doi', 'title', 'author', 'year']),
    state: z.enum(['matched', 'mismatch', 'inconclusive', 'not_available']),
    expected: z.union([z.string(), z.number()]),
    observed: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
    note: z.string().optional(),
  })
  .strict();
export type Comparison = z.infer<typeof comparisonSchema>;

export const provenanceSchema = z
  .object({
    provider: providerSchema,
    queryType: z.string(),
    /** The minimal fields actually sent, or the identifier looked up. */
    query: z.record(z.string(), z.union([z.string(), z.number()])),
    /** Origin and path of the provider endpoint, without query string (no contact or key). */
    endpoint: z.string(),
    requestedAt: z.string(),
    retrievedAt: z.string().optional(),
    /** The provider followed a same-origin redirect, e.g. a merged OpenAlex work id. */
    redirected: z.boolean().optional(),
    canonicalId: z.string().optional(),
    /** External provider data, as opposed to model inference or document evidence. */
    sourceKind: z.enum(['external_provider_result', 'local_library_result']),
  })
  .strict();
export type Provenance = z.infer<typeof provenanceSchema>;

export const recordSchema = z
  .object({ metadata: metadataSchema, provenance: provenanceSchema, comparison: z.array(comparisonSchema) })
  .strict();
export type EvidenceRecord = z.infer<typeof recordSchema>;

export const errorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    httpStatus: z.number().optional(),
    retryAfterMs: z.number().optional(),
  })
  .strict();
export type ErrorDetails = z.infer<typeof errorSchema>;

/**
 * DOI verification is three separate observations, never one `valid` flag:
 * the identifier is recognizable, a provider returned a record, and the record's metadata agrees
 * with the values compared.
 */
export const doiVerificationSchema = z
  .object({
    syntax: z.enum(['recognized', 'not_recognized']),
    providerRecord: z.enum(['found', 'not_found', 'not_checked']),
    metadataAgreement: z.enum(['all_compared_fields_matched', 'mismatch_observed', 'inconclusive', 'not_compared']),
  })
  .strict();
export type DoiVerification = z.infer<typeof doiVerificationSchema>;

export const providerResultSchema = z
  .object({
    provider: providerSchema,
    status: statusSchema,
    provenance: provenanceSchema,
    records: z.array(recordSchema).max(LIMITS.results),
    doiVerification: doiVerificationSchema.optional(),
    pagination: z
      .object({
        limit: z.number(),
        hasMore: z.boolean(),
        nextStart: z.number().optional(),
        nextPage: z.number().optional(),
        capped: z.boolean(),
      })
      .strict()
      .optional(),
    cacheHit: z.boolean().optional(),
    /** Fixed interpretation limits for the caller; no verdict about the reference. */
    interpretation: z
      .object({ note: z.string(), claimSupport: z.literal('cannot_be_verified_from_metadata_alone') })
      .strict(),
    error: errorSchema.optional(),
  })
  .strict();
export type ProviderResult = z.infer<typeof providerResultSchema>;

/**
 * Recognizes a DOI in its bare, `doi:` or doi.org URL form and returns it lower-cased (DOIs are
 * case-insensitive). It does not resolve the DOI, certify that it exists, guess missing parts or
 * repair punctuation. Returns undefined for anything else, including other URLs.
 */
export function normalizeDoi(input: string): string | undefined {
  let value = input.trim().replace(/^doi:\s*/iu, '');
  const url = /^https?:\/\/(?:dx\.)?doi\.org\//iu;
  if (url.test(value)) {
    try {
      value = decodeURIComponent(value.replace(url, ''));
    } catch {
      return undefined;
    }
  }
  if (value.length > LIMITS.queryText || !/^10\.\d{4,9}\/[^\s\u0000-\u001f\u007f?#]+$/u.test(value)) {
    return undefined;
  }
  return value.toLowerCase();
}
