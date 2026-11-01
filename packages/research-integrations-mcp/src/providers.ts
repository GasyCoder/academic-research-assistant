/*
 * Read-only Crossref, OpenAlex and Zotero adapters.
 *
 * Each call checks its own network consent before any cache or network access, sends only the
 * identifier or the minimal bibliographic fields of the query, and returns one provider's own
 * status, records, provenance and sanitized error. Destinations are fixed official endpoints;
 * only the internal test harness can point them at a loopback fake server.
 */
import {
  IntegrationError,
  LIMITS,
  crossrefLookupSchema,
  crossrefSearchSchema,
  normalizeDoi,
  openalexLookupSchema,
  openalexSearchSchema,
  parseInput,
  safeError,
  zoteroGetSchema,
  zoteroSearchSchema,
  type Comparison,
  type DoiVerification,
  type Expected,
  type Metadata,
  type Provenance,
  type Provider,
  type ProviderResult,
  type Status,
} from './contracts.js';
import { redact, secretsOf, type Config } from './config.js';
import { JsonClient, type HttpOptions } from './http.js';
import { array, compareMetadata, crossrefMetadata, object, openalexMetadata, zoteroMetadata } from './metadata.js';
import { USER_AGENT } from './version.js';

/** Official endpoints. The Crossref version is pinned in the path, as Crossref recommends. */
const BASES = {
  crossref: 'https://api.crossref.org/v1/',
  openalex: 'https://api.openalex.org/',
  zotero: 'https://api.zotero.org/',
  /** Zotero Desktop local API: loopback only, used only after the operator's opt-in. */
  zoteroLocal: 'http://127.0.0.1:23119/api/',
} as const;
type Base = keyof typeof BASES;

/** Zotero API version sent on every request, rather than relying on a server default. */
const ZOTERO_API_VERSION = '3';

/** Fields requested from OpenAlex: no abstract, references or full text. */
const OPENALEX_SELECT =
  'id,doi,title,display_name,publication_year,publication_date,ids,authorships,primary_location,biblio,type,is_retracted';
/** Fields requested from Crossref searches (the DOI route does not support select). */
const CROSSREF_SELECT =
  'DOI,title,author,issued,published,published-print,published-online,container-title,volume,issue,page,article-number,type,URL';

const NAMES: Record<Provider, string> = { crossref: 'Crossref', openalex: 'OpenAlex', zotero: 'Zotero' };

/** Fixed interpretation limits per status. They describe the observation, never the reference. */
function interpretationNote(provider: Provider, status: Status): string {
  const name = NAMES[provider];
  switch (status) {
    case 'exact_match':
      return `The ${name} record has the identifier looked up and no compared value disagrees. This is metadata agreement only.`;
    case 'candidate_match':
      return `One ${name} candidate was returned; its identity with the cited work is not established.`;
    case 'ambiguous':
      return `Several ${name} candidates may match; none is selected.`;
    case 'metadata_mismatch':
      return `A ${name} record disagrees with at least one compared value; inspect the comparison and retained dates.`;
    case 'not_found':
      return `No matching ${name} record was found for this query. Provider coverage is not exhaustive: this is not evidence that the work does not exist.`;
    case 'unavailable':
      return `${name} returned no usable result; this says nothing about the reference.`;
    case 'rate_limited':
      return `${name} or the local client asked to wait; no verification result was obtained.`;
    case 'authentication_required':
      return `${name} requires authentication or permission for this request; nothing was read.`;
    case 'verification_not_performed':
      return `No request was sent to ${name}.`;
  }
}

/** Test harness only: loopback fake servers. No environment variable or tool can set this. */
export interface TestOptions extends HttpOptions {
  testBases?: Partial<Record<Base, string>>;
}

interface ProviderRequest {
  provider: Provider;
  queryType: string;
  query: Provenance['query'];
  url: URL;
  consent: boolean;
  headers?: Record<string, string>;
  expected?: Expected;
  /** Identifier looked up; an exact match requires the record to carry it. */
  lookupId?: string;
  doiLookup?: boolean;
  local?: boolean;
  privateLibrary?: boolean;
  /** Public metadata only. */
  cache: boolean;
  maxRedirects: number;
  search?: { limit: number; start?: number; page?: number };
  decode: (raw: unknown) => { metadata: Metadata[]; total?: number };
}

export class MetadataProviders {
  private readonly bases: Record<Base, string> = { ...BASES };
  private readonly http: JsonClient;
  private readonly secrets: string[];

  constructor(
    private readonly config: Config,
    tests: TestOptions = {},
  ) {
    for (const [key, value] of Object.entries(tests.testBases ?? {})) {
      this.bases[key as Base] = loopbackBase(value);
    }
    this.http = new JsonClient(config, tests);
    this.secrets = secretsOf(config);
  }

  async crossrefLookup(input: unknown): Promise<ProviderResult> {
    const i = parseInput(crossrefLookupSchema, input);
    const doi = normalizeDoi(i.doi);
    checkExpected(i.expected, doi);
    const url = new URL(`works/${encodeURIComponent(doi ?? '')}`, this.bases.crossref);
    if (doi === undefined) {
      return this.unrecognizedDoi('crossref', url);
    }
    return this.request({
      provider: 'crossref',
      queryType: 'doi_lookup',
      query: { doi },
      url,
      consent: i.networkConsent,
      expected: i.expected,
      lookupId: doi,
      doiLookup: true,
      cache: true,
      maxRedirects: 0,
      decode: (raw) => ({ metadata: [crossrefMetadata(object(raw).message)] }),
    });
  }

  async crossrefSearch(input: unknown): Promise<ProviderResult> {
    const i = parseInput(crossrefSearchSchema, input);
    const url = new URL('works', this.bases.crossref);
    url.searchParams.set('query.title', i.title);
    if (i.author) {
      url.searchParams.set('query.author', i.author);
    }
    if (i.year) {
      url.searchParams.set('filter', `from-pub-date:${i.year - 1}-01-01,until-pub-date:${i.year + 1}-12-31`);
    }
    url.searchParams.set('rows', String(i.limit + 1));
    url.searchParams.set('offset', String(i.start));
    url.searchParams.set('select', CROSSREF_SELECT);
    return this.request({
      provider: 'crossref',
      queryType: 'bibliographic_search',
      query: compact({ title: i.title, author: i.author, year: i.year, limit: i.limit, start: i.start }),
      url,
      consent: i.networkConsent,
      expected: { title: i.title, author: i.author, year: i.year },
      cache: true,
      maxRedirects: 0,
      search: { limit: i.limit, start: i.start },
      decode: (raw) => {
        const message = object(object(raw).message);
        return { metadata: array(message.items).slice(0, i.limit + 1).map(crossrefMetadata), total: count(message['total-results']) };
      },
    });
  }

  async openalexLookup(input: unknown): Promise<ProviderResult> {
    const i = parseInput(openalexLookupSchema, input);
    const work = /^(?:https:\/\/openalex\.org\/)?(W[1-9]\d{0,14})$/iu.exec(i.id);
    if (work) {
      const id = work[1]!.toUpperCase();
      checkExpected(i.expected, undefined);
      return this.openalexWork(`https://openalex.org/${id}`, id, i.expected, i.networkConsent, false);
    }
    const doi = normalizeDoi(i.id);
    checkExpected(i.expected, doi);
    if (doi === undefined) {
      return this.unrecognizedDoi('openalex', new URL('works', this.bases.openalex));
    }
    return this.openalexWork(doi, `doi:${doi}`, i.expected, i.networkConsent, true);
  }

  private openalexWork(lookupId: string, path: string, expected: Expected | undefined, consent: boolean, doiLookup: boolean) {
    const url = new URL(`works/${encodeURIComponent(path)}`, this.bases.openalex);
    url.searchParams.set('select', OPENALEX_SELECT);
    return this.request({
      provider: 'openalex',
      queryType: doiLookup ? 'doi_lookup' : 'work_id_lookup',
      query: doiLookup ? { doi: lookupId } : { openalexId: lookupId },
      url,
      consent,
      expected,
      lookupId,
      doiLookup,
      cache: true,
      // OpenAlex redirects merged work ids to the surviving record on the same origin.
      maxRedirects: 2,
      decode: (raw) => ({ metadata: [openalexMetadata(raw)] }),
    });
  }

  async openalexSearch(input: unknown): Promise<ProviderResult> {
    const i = parseInput(openalexSearchSchema, input);
    const url = new URL('works', this.bases.openalex);
    // Title-scoped search; the author is only compared locally, never sent.
    url.searchParams.set('search.title', i.title);
    if (i.year) {
      url.searchParams.set('filter', `publication_year:${i.year - 1}-${i.year + 1}`);
    }
    url.searchParams.set('per_page', String(i.limit));
    url.searchParams.set('page', String(i.page));
    url.searchParams.set('select', OPENALEX_SELECT);
    return this.request({
      provider: 'openalex',
      queryType: 'title_search',
      query: compact({ title: i.title, year: i.year, limit: i.limit, page: i.page }),
      url,
      consent: i.networkConsent,
      expected: { title: i.title, author: i.author, year: i.year },
      cache: true,
      maxRedirects: 0,
      search: { limit: i.limit, page: i.page },
      decode: (raw) => {
        const response = object(raw);
        const meta = response.meta == null ? {} : object(response.meta);
        return { metadata: array(response.results).slice(0, i.limit).map(openalexMetadata), total: count(meta.count) };
      },
    });
  }

  async zoteroGet(input: unknown): Promise<ProviderResult> {
    const i = parseInput(zoteroGetSchema, input);
    const prefix = `${i.libraryType}/${i.libraryId}`;
    const local = i.mode === 'local';
    const url = new URL(`${prefix}/items/${i.itemKey}`, local ? this.bases.zoteroLocal : this.bases.zotero);
    url.searchParams.set('format', 'json');
    return this.request({
      provider: 'zotero',
      queryType: 'get_item',
      query: { library: prefix, itemKey: i.itemKey, access: i.access, mode: i.mode },
      url,
      consent: i.networkConsent,
      headers: { 'Zotero-API-Version': ZOTERO_API_VERSION },
      local,
      privateLibrary: i.access === 'private',
      lookupId: `${prefix}/items/${i.itemKey}`,
      cache: false,
      maxRedirects: 0,
      decode: (raw) => {
        const metadata = zoteroMetadata(raw, prefix);
        // An item read by key must carry that key.
        if (metadata.providerRecordId !== `${prefix}/items/${i.itemKey}`) {
          throw new IntegrationError('INVALID_RESPONSE');
        }
        return { metadata: [metadata] };
      },
    });
  }

  async zoteroSearch(input: unknown): Promise<ProviderResult> {
    const i = parseInput(zoteroSearchSchema, input);
    const prefix = `${i.libraryType}/${i.libraryId}`;
    const local = i.mode === 'local';
    const url = new URL(`${prefix}/items/top`, local ? this.bases.zoteroLocal : this.bases.zotero);
    for (const [key, value] of Object.entries({ format: 'json', q: i.query, qmode: 'titleCreatorYear', limit: i.limit, start: i.start })) {
      url.searchParams.set(key, String(value));
    }
    return this.request({
      provider: 'zotero',
      queryType: 'item_search',
      query: { library: prefix, query: i.query, limit: i.limit, start: i.start, access: i.access, mode: i.mode },
      url,
      consent: i.networkConsent,
      headers: { 'Zotero-API-Version': ZOTERO_API_VERSION },
      local,
      privateLibrary: i.access === 'private',
      cache: false,
      maxRedirects: 0,
      search: { limit: i.limit, start: i.start },
      decode: (raw) => ({ metadata: array(raw).slice(0, i.limit).map((item) => zoteroMetadata(item, prefix)) }),
    });
  }

  /** A DOI tool given something that is not a recognizable DOI: no request, no correction. */
  private unrecognizedDoi(provider: Provider, url: URL): ProviderResult {
    const status: Status = 'verification_not_performed';
    return {
      provider,
      status,
      provenance: this.provenance(provider, 'doi_lookup', {}, url, false),
      records: [],
      doiVerification: { syntax: 'not_recognized', providerRecord: 'not_checked', metadataAgreement: 'not_compared' },
      interpretation: { note: interpretationNote(provider, status), claimSupport: 'cannot_be_verified_from_metadata_alone' },
      error: new IntegrationError('DOI_NOT_RECOGNIZED').details(),
    };
  }

  private provenance(provider: Provider, queryType: string, query: Provenance['query'], url: URL, local: boolean): Provenance {
    return {
      provider,
      queryType,
      query,
      endpoint: url.origin + url.pathname,
      requestedAt: new Date().toISOString(),
      sourceKind: local ? 'local_library_result' : 'external_provider_result',
    };
  }

  private async request(r: ProviderRequest): Promise<ProviderResult> {
    const provenance = this.provenance(r.provider, r.queryType, r.query, r.url, Boolean(r.local));
    let result: ProviderResult;
    try {
      // Consent first: nothing is read from the cache or sent before it.
      if (!r.consent) {
        throw new IntegrationError('NETWORK_CONSENT_REQUIRED');
      }
      if (r.local && !this.config.zoteroLocal) {
        throw new IntegrationError('LOCAL_ZOTERO_DISABLED');
      }
      // Private web libraries need a key: refused before any request rather than downgraded.
      if (r.privateLibrary && !r.local && !this.config.zoteroKey) {
        throw new IntegrationError('AUTHENTICATION_REQUIRED');
      }
      const response = await this.http.get({
        url: r.url,
        headers: this.headers(r),
        cache: r.cache,
        maxRedirects: r.maxRedirects,
      });
      provenance.retrievedAt = response.retrievedAt;
      if (response.redirected) {
        provenance.redirected = true;
      }
      const decoded = r.decode(response.data);
      const candidates = decoded.metadata.slice(0, r.search?.limit ?? 1);
      const records = candidates.map((metadata) => ({
        metadata,
        provenance: { ...provenance, canonicalId: metadata.providerRecordId },
        comparison: compareMetadata(r.expected ?? {}, metadata),
      }));
      const pagination = r.search ? paginate(r.search, decoded.metadata.length, records.length, decoded.total ?? response.totalResults) : undefined;
      const status = statusOf(records, r, pagination?.hasMore ?? false);
      result = {
        provider: r.provider,
        status,
        provenance,
        records,
        ...(r.doiLookup ? { doiVerification: doiVerification(records.map((x) => x.comparison)[0], 'found') } : {}),
        ...(pagination ? { pagination } : {}),
        cacheHit: response.cacheHit,
        interpretation: { note: interpretationNote(r.provider, status), claimSupport: 'cannot_be_verified_from_metadata_alone' },
      };
    } catch (unknownError) {
      let error = safeError(unknownError);
      // A Crossref 403 is a manual block and a local 403 a disabled Desktop API: no key would help.
      if (error.code === 'AUTHENTICATION_REQUIRED' && (r.provider === 'crossref' || r.local)) {
        error = new IntegrationError('HTTP_ERROR', error.httpStatus, undefined, error.receivedAt);
      }
      if (error.receivedAt) {
        provenance.retrievedAt = error.receivedAt;
      }
      const status = failureStatus(error);
      result = {
        provider: r.provider,
        status,
        provenance,
        records: [],
        ...(r.doiLookup
          ? { doiVerification: doiVerification(undefined, status === 'not_found' ? 'not_found' : 'not_checked') }
          : {}),
        interpretation: { note: interpretationNote(r.provider, status), claimSupport: 'cannot_be_verified_from_metadata_alone' },
        error: error.details(),
      };
    }
    const clean = this.redactResult(result);
    if (Buffer.byteLength(JSON.stringify(clean)) > LIMITS.resultBytes) {
      const status: Status = 'unavailable';
      return {
        provider: r.provider,
        status,
        provenance: this.redactProvenance(provenance),
        records: [],
        interpretation: { note: interpretationNote(r.provider, status), claimSupport: 'cannot_be_verified_from_metadata_alone' },
        error: new IntegrationError('RESPONSE_TOO_LARGE').details(),
      };
    }
    return clean;
  }

  /**
   * Removes echoed secrets from free-form values only: provider metadata, caller-supplied query
   * and comparison values, endpoint and canonical id. Statuses, codes and other protocol fields
   * are fixed by this package and stay intact even if a secret happens to equal one of them.
   */
  private redactResult(result: ProviderResult): ProviderResult {
    if (this.secrets.length === 0) {
      return result;
    }
    return {
      ...result,
      provenance: this.redactProvenance(result.provenance),
      records: result.records.map((record) => ({
        metadata: { ...redact(record.metadata, this.secrets), provider: record.metadata.provider },
        provenance: this.redactProvenance(record.provenance),
        comparison: record.comparison.map((c) => ({
          ...c,
          expected: redact(c.expected, this.secrets),
          ...(c.observed === undefined ? {} : { observed: redact(c.observed, this.secrets) }),
        })),
      })),
    };
  }

  private redactProvenance(provenance: Provenance): Provenance {
    return {
      ...provenance,
      query: redact(provenance.query, this.secrets),
      endpoint: redact(provenance.endpoint, this.secrets),
      ...(provenance.canonicalId === undefined ? {} : { canonicalId: redact(provenance.canonicalId, this.secrets) }),
    };
  }

  private headers(r: ProviderRequest): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': USER_AGENT, ...r.headers };
    if (r.provider === 'crossref' && this.config.crossrefContact) {
      // Crossref's polite pool: contact in User-Agent and mailto. Never in provenance or results.
      headers['User-Agent'] += ` mailto:${this.config.crossrefContact}`;
      r.url.searchParams.set('mailto', this.config.crossrefContact);
    }
    if (r.provider === 'openalex' && this.config.openalexKey) {
      headers.Authorization = `Bearer ${this.config.openalexKey}`;
    }
    // Public Zotero reads never carry the key, even when one is configured; local reads need none.
    if (r.provider === 'zotero' && r.privateLibrary && !r.local && this.config.zoteroKey) {
      headers['Zotero-API-Key'] = this.config.zoteroKey;
    }
    return headers;
  }
}

/** Expected DOI must agree with the DOI looked up: contradictory input is refused, not reconciled. */
function checkExpected(expected: Expected | undefined, lookupDoi: string | undefined): void {
  if (expected?.doi === undefined) {
    return;
  }
  const wanted = normalizeDoi(expected.doi);
  if (wanted === undefined || (lookupDoi !== undefined && wanted !== lookupDoi)) {
    throw new IntegrationError('INVALID_INPUT');
  }
}

function statusOf(records: { metadata: Metadata; comparison: Comparison[] }[], r: ProviderRequest, hasMore: boolean): Status {
  if (records.length === 0) {
    return 'not_found';
  }
  // A search never establishes identity: several candidates, or more beyond this page, are ambiguous.
  if (r.search && (records.length > 1 || hasMore)) {
    return 'ambiguous';
  }
  const [record] = records;
  if (record!.comparison.some((c) => c.state === 'mismatch')) {
    return 'metadata_mismatch';
  }
  if (r.lookupId && (record!.metadata.doi === r.lookupId || record!.metadata.providerRecordId === r.lookupId)) {
    return 'exact_match';
  }
  return 'candidate_match';
}

function failureStatus(error: IntegrationError): Status {
  switch (error.code) {
    case 'NOT_FOUND':
      return 'not_found';
    case 'AUTHENTICATION_REQUIRED':
      return 'authentication_required';
    case 'RATE_LIMITED':
    case 'CLIENT_COOLDOWN':
      return 'rate_limited';
    case 'NETWORK_CONSENT_REQUIRED':
    case 'LOCAL_ZOTERO_DISABLED':
      return 'verification_not_performed';
    default:
      return 'unavailable';
  }
}

/** The three DOI observations, kept apart. Agreement covers caller-supplied fields other than the DOI. */
function doiVerification(comparison: Comparison[] | undefined, providerRecord: DoiVerification['providerRecord']): DoiVerification {
  const compared = (comparison ?? []).filter((c) => c.field !== 'doi');
  let metadataAgreement: DoiVerification['metadataAgreement'] = 'not_compared';
  if (compared.some((c) => c.state === 'mismatch')) {
    metadataAgreement = 'mismatch_observed';
  } else if (compared.some((c) => c.state !== 'matched')) {
    metadataAgreement = 'inconclusive';
  } else if (compared.length > 0) {
    metadataAgreement = 'all_compared_fields_matched';
  }
  return { syntax: 'recognized', providerRecord, metadataAgreement };
}

function paginate(
  search: NonNullable<ProviderRequest['search']>,
  decoded: number,
  returned: number,
  total: number | undefined,
): NonNullable<ProviderResult['pagination']> {
  const start = search.start ?? ((search.page ?? 1) - 1) * search.limit;
  // Without a total, a full page conservatively signals that more may exist.
  const hasMore = decoded > returned || (total === undefined ? returned === search.limit : start + returned < total);
  const capped = hasMore && (search.page !== undefined ? search.page >= LIMITS.maxPage : start + search.limit > LIMITS.maxStart);
  return {
    limit: search.limit,
    hasMore,
    capped,
    ...(hasMore && !capped && search.start !== undefined ? { nextStart: start + search.limit } : {}),
    ...(hasMore && !capped && search.page !== undefined ? { nextPage: search.page + 1 } : {}),
  };
}

function count(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  return Number(value);
}

function compact(query: Record<string, string | number | undefined>): Provenance['query'] {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Provenance['query'];
}

/** Test base: literal loopback HTTP origin, without credentials, query or fragment. */
function loopbackBase(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new IntegrationError('CONFIGURATION_ERROR');
  }
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new IntegrationError('CONFIGURATION_ERROR');
  }
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
}
