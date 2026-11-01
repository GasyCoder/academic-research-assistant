/*
 * Provider record decoding and transparent, deterministic comparisons.
 *
 * Decoders keep a short allowlist of bibliographic fields. Missing values stay absent, original
 * strings are not rewritten, and abstracts, notes, attachments and arbitrary provider JSON are
 * never returned. Comparisons normalize only for comparing; they report a state per field and
 * never a score, a probability or a verdict about a reference.
 */
import {
  IntegrationError,
  LIMITS,
  normalizeDoi,
  type Comparison,
  type EvidenceRecord,
  type Expected,
  type Metadata,
} from './contracts.js';

type Author = NonNullable<Metadata['authors']>[number];

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  return value;
}

const optionalObject = (value: unknown): Record<string, unknown> => (value == null ? {} : object(value));

/** Collects the fields of one record, with the reason for any value left out. */
class Decoder {
  readonly omissions = new Set<string>();

  /** A string field; non-strings are malformed, overlong strings are omitted and reported. */
  text(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    if (value.length > LIMITS.metadataText) {
      this.omissions.add(`FIELD_TOO_LONG:${field}`);
      return undefined;
    }
    return value;
  }

  required(value: unknown, field: string): string {
    const result = this.text(value, field);
    if (!result?.trim()) {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    return result;
  }

  first(value: unknown, field: string): string | undefined {
    return value == null ? undefined : this.text(array(value)[0], field);
  }

  doi(value: unknown): string | undefined {
    const raw = this.text(value, 'doi');
    if (raw === undefined) {
      return undefined;
    }
    const doi = normalizeDoi(raw);
    if (doi === undefined) {
      this.omissions.add('DOI_NOT_RECOGNIZED');
    }
    return doi;
  }

  /** Kept only if it is a plain http(s) URL without credentials. Never fetched. */
  url(value: unknown, field: string): string | undefined {
    const raw = this.text(value, field);
    if (raw === undefined) {
      return undefined;
    }
    try {
      const parsed = new URL(raw);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
        return raw;
      }
    } catch {
      // Not a URL: omitted below.
    }
    this.omissions.add(`URL_OMITTED:${field}`);
    return undefined;
  }

  authors(raw: unknown, convert: (entry: Record<string, unknown>) => Author): Author[] | undefined {
    if (raw == null) {
      return undefined;
    }
    const entries = array(raw);
    if (entries.length > LIMITS.authors) {
      this.omissions.add('AUTHORS_TRUNCATED');
    }
    const authors = entries.slice(0, LIMITS.authors).map((entry) => convert(object(entry)));
    return authors.length > 0 ? authors : undefined;
  }

  finish(metadata: Metadata): Metadata {
    const result = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as Metadata;
    if (this.omissions.size > 0) {
      result.omissions = [...this.omissions];
    }
    return result;
  }
}

function year(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Number.isInteger(value) || Number(value) < 1000 || Number(value) > 3000) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  return Number(value);
}

/** Crossref date fields, in the order used to choose the primary year. All are retained. */
const CROSSREF_DATES = ['issued', 'published', 'published-print', 'published-online'] as const;

/** One item of a Crossref `message` (DOI lookup) or `message.items` (search). */
export function crossrefMetadata(raw: unknown): Metadata {
  const record = object(raw);
  const d = new Decoder();
  const id = d.required(record.DOI, 'DOI');
  const dates: Record<string, string> = {};
  for (const name of CROSSREF_DATES) {
    const parts = optionalObject(record[name])['date-parts'];
    if (parts == null) {
      continue;
    }
    const date = array(array(parts)[0] ?? []);
    // Crossref encodes an unknown date as [[null]].
    if (date.length === 0 || date[0] === null) {
      continue;
    }
    year(date[0]);
    dates[name] = date
      .map((part) => {
        if (!Number.isInteger(part)) {
          throw new IntegrationError('INVALID_RESPONSE');
        }
        return String(part);
      })
      .join('-');
  }
  const yearSource = CROSSREF_DATES.find((name) => dates[name] !== undefined);
  return d.finish({
    provider: 'crossref',
    providerRecordId: id,
    doi: d.doi(id),
    title: d.first(record.title, 'title'),
    authors: d.authors(record.author, (a) => withoutEmpty({
      name: d.text(a.name, 'author.name'),
      given: d.text(a.given, 'author.given'),
      family: d.text(a.family, 'author.family'),
      orcid: d.url(a.ORCID, 'author.ORCID'),
    })),
    year: yearSource ? Number(dates[yearSource]!.split('-')[0]) : undefined,
    yearSource,
    dates: Object.keys(dates).length > 0 ? dates : undefined,
    container: d.first(record['container-title'], 'container-title'),
    volume: d.text(record.volume, 'volume'),
    issue: d.text(record.issue, 'issue'),
    pages: d.text(record.page, 'page'),
    articleNumber: d.text(record['article-number'], 'article-number'),
    type: d.text(record.type, 'type'),
    url: d.url(record.URL, 'URL'),
    identifiers: { doi: id },
  });
}

/** One OpenAlex work object. The W id and the DOI stay distinct identifiers. */
export function openalexMetadata(raw: unknown): Metadata {
  const record = object(raw);
  const d = new Decoder();
  const id = d.required(record.id, 'id');
  if (!/^https:\/\/openalex\.org\/W[1-9]\d*$/u.test(id)) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  const ids = optionalObject(record.ids);
  const identifiers: Record<string, string> = { openalex: id };
  for (const name of ['doi', 'pmid', 'pmcid', 'mag']) {
    const value = ids[name] == null ? undefined : d.text(typeof ids[name] === 'number' ? String(ids[name]) : ids[name], `ids.${name}`);
    if (value) {
      identifiers[name] = value;
    }
  }
  const biblio = optionalObject(record.biblio);
  const location = optionalObject(record.primary_location);
  const source = optionalObject(location.source);
  const firstPage = d.text(biblio.first_page, 'biblio.first_page');
  const lastPage = d.text(biblio.last_page, 'biblio.last_page');
  const publicationYear = year(record.publication_year);
  const publicationDate = d.text(record.publication_date, 'publication_date');
  return d.finish({
    provider: 'openalex',
    providerRecordId: id,
    doi: d.doi(record.doi ?? ids.doi),
    title: d.text(record.title ?? record.display_name, 'title'),
    authors: d.authors(record.authorships, (a) => {
      const author = optionalObject(a.author);
      return withoutEmpty({
        name: d.text(author.display_name, 'author.display_name'),
        orcid: d.url(author.orcid, 'author.orcid'),
      });
    }),
    year: publicationYear,
    yearSource: publicationYear === undefined ? undefined : 'publication_year',
    dates: publicationDate ? { publication_date: publicationDate } : undefined,
    container: d.text(source.display_name, 'primary_location.source.display_name'),
    volume: d.text(biblio.volume, 'biblio.volume'),
    issue: d.text(biblio.issue, 'biblio.issue'),
    pages: firstPage ? (lastPage && lastPage !== firstPage ? `${firstPage}-${lastPage}` : firstPage) : undefined,
    type: d.text(record.type, 'type'),
    url: d.url(location.landing_page_url, 'primary_location.landing_page_url'),
    identifiers,
    providerFlags: typeof record.is_retracted === 'boolean' ? { 'openalex.is_retracted': record.is_retracted } : undefined,
  });
}

/** One Zotero item in `format=json`. Abstracts, notes, tags, attachments and `extra` are dropped. */
export function zoteroMetadata(raw: unknown, libraryPrefix: string): Metadata {
  const record = object(raw);
  const d = new Decoder();
  const key = d.required(record.key, 'key');
  if (!/^[A-Z0-9]{8}$/u.test(key)) {
    throw new IntegrationError('INVALID_RESPONSE');
  }
  const data = object(record.data);
  const rawDoi = d.text(data.DOI, 'doi');
  const date = d.text(data.date, 'date');
  const dateYear = date ? /(?:^|\D)([12]\d{3})(?:\D|$)/u.exec(date) : null;
  return d.finish({
    provider: 'zotero',
    providerRecordId: `${libraryPrefix}/items/${key}`,
    doi: d.doi(rawDoi),
    title: d.text(data.title, 'title'),
    authors: d.authors(data.creators, (c) => withoutEmpty({
      name: d.text(c.name, 'creator.name'),
      given: d.text(c.firstName, 'creator.firstName'),
      family: d.text(c.lastName, 'creator.lastName'),
      role: d.text(c.creatorType, 'creator.creatorType'),
    })),
    year: dateYear ? Number(dateYear[1]) : undefined,
    yearSource: dateYear ? 'date' : undefined,
    dates: date ? { date } : undefined,
    container: d.text(data.publicationTitle ?? data.bookTitle ?? data.proceedingsTitle, 'container'),
    volume: d.text(data.volume, 'volume'),
    issue: d.text(data.issue, 'issue'),
    pages: d.text(data.pages, 'pages'),
    type: d.text(data.itemType, 'itemType'),
    url: d.url(data.url, 'url'),
    identifiers: { zotero: key, ...(rawDoi ? { doi: rawDoi } : {}) },
  });
}

function withoutEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

// ---------------------------------------------------------------------------------------------
// Comparisons

/** Comparison-only normalization: Unicode NFC, case folding and whitespace. Values are not changed. */
export const normalizeText = (value: string): string => value.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
/** Titles also ignore trailing sentence punctuation; symbols and inner punctuation are significant. */
const titleKey = (value: string): string => normalizeText(value).replace(/[.,;:!?]+$/u, '').trim();

const YEAR_NOTE =
  'Online, print and issue dates can differ for one work; a year difference is not by itself an error in the reference.';
const AUTHOR_NOTE =
  'Names are not identity proof: initials, diacritics, name order and partial bylines need human assessment.';

/**
 * Compares the values supplied from the document with one record. Only fields both sides have
 * are compared; an absent provider value is `not_available`, never a mismatch.
 */
export function compareMetadata(expected: Expected, metadata: Metadata): Comparison[] {
  const comparisons: Comparison[] = [];

  if (expected.doi !== undefined) {
    const wanted = normalizeDoi(expected.doi);
    comparisons.push({
      field: 'doi',
      expected: expected.doi,
      ...(metadata.doi === undefined ? { state: 'not_available' } : {
        observed: metadata.doi,
        state: wanted !== undefined && wanted === metadata.doi ? 'matched' : 'mismatch',
      }),
    });
  }

  if (expected.title !== undefined) {
    comparisons.push(compareTitle(expected.title, metadata.title));
  }

  if (expected.author !== undefined) {
    comparisons.push(compareAuthor(expected.author, metadata.authors));
  }

  if (expected.year !== undefined) {
    comparisons.push(compareYear(expected.year, metadata));
  }
  return comparisons;
}

function compareTitle(expected: string, observed: string | undefined): Comparison {
  if (observed === undefined) {
    return { field: 'title', expected, state: 'not_available' };
  }
  const a = titleKey(expected);
  const b = titleKey(observed);
  if (a === b) {
    return { field: 'title', expected, observed, state: 'matched' };
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length > 0 && longer.startsWith(shorter) && /^\s*[:.\-–—]/u.test(longer.slice(shorter.length))) {
    return {
      field: 'title',
      expected,
      observed,
      state: 'inconclusive',
      note: 'One title extends the other after a separator, possibly a subtitle; verify which form is intended.',
    };
  }
  return { field: 'title', expected, observed, state: 'mismatch' };
}

function compareAuthor(expected: string, authors: Metadata['authors']): Comparison {
  const people = (authors ?? []).filter((a) => !a.role || a.role === 'author');
  const names = people.map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(' ')).filter((n) => n.length > 0);
  if (names.length === 0) {
    return { field: 'author', expected, state: 'not_available', note: AUTHOR_NOTE };
  }
  const wanted = normalizeText(expected);
  // Exact initial strings and multi-word family names do not establish full-name agreement.
  const initials = (name: string) => name.split(/[\s-]+/u).some(token =>
    /^\p{L}\.?$/u.test(token) || /^(?:\p{L}\.)+$/u.test(token));
  const fullMatch = people.some(person => {
    const name = person.name ?? [person.given, person.family].filter(Boolean).join(' ');
    if (!wanted.includes(' ') || initials(name) || normalizeText(name) !== wanted) return false;
    if (person.name) return true;
    return Boolean(person.given?.trim() && person.family?.trim());
  });
  if (fullMatch) {
    return { field: 'author', expected, observed: names, state: 'matched', note: AUTHOR_NOTE };
  }
  const familyNames = people.map((a) => a.family).filter((f): f is string => Boolean(f)).map(normalizeText);
  const note = familyNames.includes(wanted)
    ? `A returned family name equals the supplied name, which does not establish identity. ${AUTHOR_NOTE}`
    : AUTHOR_NOTE;
  // Name strings never establish that two people differ either: no `mismatch` for authors.
  return { field: 'author', expected, observed: names, state: 'inconclusive', note };
}

function compareYear(expected: number, metadata: Metadata): Comparison {
  if (metadata.year === undefined) {
    return { field: 'year', expected, state: 'not_available' };
  }
  if (metadata.year === expected) {
    return { field: 'year', expected, observed: metadata.year, state: 'matched' };
  }
  const other = Object.entries(metadata.dates ?? {}).find(([, value]) => Number(/^(\d{4})/u.exec(value)?.[1]) === expected);
  if (other) {
    return {
      field: 'year',
      expected,
      observed: metadata.year,
      state: 'inconclusive',
      note: `The supplied year equals the provider's ${other[0]} date, not its ${metadata.yearSource ?? 'primary'} year. ${YEAR_NOTE}`,
    };
  }
  return { field: 'year', expected, observed: metadata.year, state: 'mismatch', note: YEAR_NOTE };
}

export interface ProviderComparison {
  records: EvidenceRecord[];
  differences: { field: string; observations: { provider: string; providerRecordId: string; value: string | number }[] }[];
  recommendation: 'human_verification_recommended' | 'no_observed_metadata_disagreement';
  claimSupport: 'cannot_be_verified_from_metadata_alone';
}

/**
 * Lays records from several providers side by side. Every record and every differing value is
 * kept, with its provider; no winner is chosen and there is no majority vote. The caller must
 * ensure that the records were retrieved for the same reference.
 */
export function compareProviderRecords(records: EvidenceRecord[]): ProviderComparison {
  const differences: ProviderComparison['differences'] = [];
  for (const field of ['doi', 'title', 'year', 'container'] as const) {
    const observations = records.flatMap(({ metadata }) => {
      const value = metadata[field];
      return value === undefined ? [] : [{ provider: metadata.provider, providerRecordId: metadata.providerRecordId, value }];
    });
    const keys = new Set(observations.map(({ value }) => {
      if (typeof value !== 'string') return value;
      if (field === 'doi') return normalizeDoi(value) ?? normalizeText(value);
      return field === 'title' ? titleKey(value) : normalizeText(value);
    }));
    if (keys.size > 1) {
      differences.push({ field, observations });
    }
  }
  return {
    records,
    differences,
    recommendation: differences.length > 0 ? 'human_verification_recommended' : 'no_observed_metadata_disagreement',
    claimSupport: 'cannot_be_verified_from_metadata_alone',
  };
}
