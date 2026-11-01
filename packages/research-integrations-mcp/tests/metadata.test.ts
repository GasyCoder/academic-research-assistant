import { describe, expect, it } from 'vitest';

import { crossrefLookupSchema, normalizeDoi, parseInput } from '../src/contracts.js';
import { loadConfig, redact } from '../src/config.js';
import { compareMetadata, compareProviderRecords, crossrefMetadata, openalexMetadata, zoteroMetadata } from '../src/metadata.js';
import { createIntegrations } from '../src/service.js';
import { crossrefWork, openalexWork, zoteroItem } from './helpers.js';

describe('DOI recognition', () => {
  it.each(['10.5555/Synthetic', 'doi:10.5555/Synthetic', 'DOI: 10.5555/Synthetic', 'https://doi.org/10.5555%2FSynthetic', 'http://dx.doi.org/10.5555/Synthetic'])(
    'recognizes %s without claiming existence',
    (raw) => {
      expect(normalizeDoi(raw)).toBe('10.5555/synthetic');
    },
  );

  it.each(['not-a-doi', '10.55/too-short-prefix', 'https://example.invalid/10.5555/synthetic', '10.5555/has space', '10.5555/x?key=1', '10.5555/x#part', 'https://doi.org/%ZZ', `10.5555/${'x'.repeat(500)}`])(
    'does not recognize or repair %s',
    (raw) => {
      expect(normalizeDoi(raw)).toBeUndefined();
    },
  );
});

describe('configuration and input validation', () => {
  it('rejects unknown tool parameters without echoing them', () => {
    expect(() => parseInput(crossrefLookupSchema, { doi: '10.5555/x', apiKey: 'SYNTHETIC_SECRET' })).toThrow(
      'Invalid integration input',
    );
    expect(() => parseInput(crossrefLookupSchema, { doi: '10.5555/x', baseUrl: 'http://169.254.169.254/' })).toThrow();
  });

  it('uses safe defaults and refuses malformed variables with a fixed message', () => {
    expect(loadConfig({})).toMatchObject({ timeoutMs: 10_000, cacheTtlMs: 60_000, zoteroLocal: false });
    for (const env of [
      { ARA_OPENALEX_API_KEY: 'secret\r\nX-Injected: 1' },
      { ARA_ZOTERO_API_KEY: 'short' },
      { ARA_INTEGRATIONS_TIMEOUT_MS: 'NaN' },
      { ARA_INTEGRATIONS_TIMEOUT_MS: '0' },
      { ARA_INTEGRATIONS_RESPONSE_BYTES: '999999999' },
      { ARA_CROSSREF_CONTACT: 'contact\n@example.invalid' },
      { ARA_VALE_PATH: 'vale --flag' },
      { ARA_ZOTERO_LOCAL: 'true' },
    ]) {
      let message = '';
      try {
        loadConfig(env);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe('Invalid integration configuration');
    }
  });

  it('restricts the internal test destinations to literal loopback HTTP', () => {
    for (const base of ['https://example.invalid/', 'http://169.254.169.254/', 'http://127.0.0.1@example.invalid/', 'http://localhost/', 'file:///tmp/x', 'http://127.0.0.1/?x=1']) {
      expect(() => createIntegrations({}, { testBases: { crossref: base } })).toThrow();
    }
  });

  it('redacts configured secrets in raw, URL-encoded and JSON-escaped forms', () => {
    const secret = 'synthetic~key"x';
    const value = { a: secret, b: `https://x.invalid/${encodeURIComponent(secret)}`, c: [`k=${secret}`] };
    expect(JSON.stringify(redact(value, [secret]))).not.toMatch(/synthetic~key/u);
  });
});

describe('record decoding', () => {
  it('keeps absent fields absent and original strings unchanged', () => {
    const metadata = crossrefMetadata(crossrefWork({ title: ['Étude  α+β'], author: undefined, volume: '' }));
    expect(metadata.title).toBe('Étude  α+β');
    expect(metadata).not.toHaveProperty('authors');
    expect(metadata).not.toHaveProperty('volume');
    expect(JSON.stringify(metadata)).not.toContain('SYNTHETIC_ABSTRACT');
  });

  it('retains every Crossref date and names the source of the primary year', () => {
    const metadata = crossrefMetadata(crossrefWork({ issued: { 'date-parts': [[2020, 12, 1]] } }));
    expect(metadata.dates).toEqual({ issued: '2020-12-1', 'published-print': '2021-2-1', 'published-online': '2020-12-1' });
    expect(metadata).toMatchObject({ year: 2020, yearSource: 'issued' });
    expect(crossrefMetadata(crossrefWork({ issued: { 'date-parts': [[null]] } })).yearSource).toBe('published-print');
  });

  it('keeps the OpenAlex work id distinct from the DOI and exposes explicit provider flags only', () => {
    const metadata = openalexMetadata(openalexWork({ is_retracted: true }));
    expect(metadata.providerRecordId).toBe('https://openalex.org/W123');
    expect(metadata.doi).toBe('10.5555/synthetic');
    expect(metadata.identifiers).toMatchObject({ openalex: 'https://openalex.org/W123', doi: 'https://doi.org/10.5555/synthetic', mag: '123' });
    expect(metadata.providerFlags).toEqual({ 'openalex.is_retracted': true });
    expect(openalexMetadata(openalexWork({ is_retracted: undefined }))).not.toHaveProperty('providerFlags');
  });

  it('drops private Zotero fields and scopes the record id to its library', () => {
    const metadata = zoteroMetadata(zoteroItem(), 'users/123');
    expect(metadata.providerRecordId).toBe('users/123/items/ABCD1234');
    expect(JSON.stringify(metadata)).not.toMatch(/SYNTHETIC_PRIVATE/u);
  });

  it('bounds authors and overlong strings explicitly, and rejects malformed types', () => {
    const many = crossrefMetadata(crossrefWork({ author: Array.from({ length: 101 }, () => ({ name: 'Synthetic Consortium' })) }));
    expect(many.authors).toHaveLength(100);
    expect(many.omissions).toContain('AUTHORS_TRUNCATED');
    const long = crossrefMetadata(crossrefWork({ title: ['x'.repeat(2001)] }));
    expect(long).not.toHaveProperty('title');
    expect(long.omissions).toContain('FIELD_TOO_LONG:title');
    expect(() => crossrefMetadata(crossrefWork({ DOI: undefined }))).toThrow('unsupported response');
    expect(() => openalexMetadata(openalexWork({ title: { raw: 'x' } }))).toThrow('unsupported response');
    expect(() => openalexMetadata(openalexWork({ id: 'https://example.invalid/W1' }))).toThrow('unsupported response');
  });

  it('omits non-http URLs instead of returning them', () => {
    const metadata = crossrefMetadata(crossrefWork({ URL: 'javascript:alert(1)' }));
    expect(metadata).not.toHaveProperty('url');
    expect(metadata.omissions).toContain('URL_OMITTED:URL');
  });
});

describe('transparent comparisons', () => {
  const record = crossrefMetadata(crossrefWork());

  it('normalizes whitespace, case, Unicode composition and trailing punctuation only', () => {
    expect(compareMetadata({ title: 'synthetic   METHODS.' }, record)[0]!.state).toBe('matched');
    expect(compareMetadata({ title: 'é' }, { ...record, title: 'é' })[0]!.state).toBe('matched');
    expect(compareMetadata({ title: 'α-β' }, { ...record, title: 'α+β' })[0]!.state).toBe('mismatch');
    expect(compareMetadata({ title: 'Synthetic Methods' }, { ...record, title: 'Synthetic Methods: A Study' })[0]).toMatchObject({
      state: 'inconclusive',
      note: expect.stringContaining('subtitle'),
    });
  });

  it('never matches authors on a lone surname and never declares an author mismatch', () => {
    expect(compareMetadata({ author: 'Ada Example' }, record)[0]!.state).toBe('matched');
    expect(compareMetadata({ author: 'Example' }, record)[0]).toMatchObject({
      state: 'inconclusive',
      note: expect.stringContaining('family name'),
    });
    expect(compareMetadata({ author: 'A. Example' }, record)[0]!.state).toBe('inconclusive');
    expect(compareMetadata({ author: 'Someone Else' }, record)[0]!.state).toBe('inconclusive');
    expect(compareMetadata({ author: 'Ada Example' }, { ...record, authors: undefined })[0]!.state).toBe('not_available');
  });

  it('treats a year matching another retained date as inconclusive, not as an error', () => {
    expect(compareMetadata({ year: 2021 }, record)[0]!.state).toBe('matched');
    expect(compareMetadata({ year: 2020 }, record)[0]).toMatchObject({ state: 'inconclusive', note: expect.stringContaining('published-online') });
    expect(compareMetadata({ year: 2019 }, record)[0]).toMatchObject({ state: 'mismatch', note: expect.stringContaining('not by itself an error') });
  });

  it('preserves provider disagreement and every record without voting', () => {
    const records = [crossrefMetadata(crossrefWork()), openalexMetadata(openalexWork())].map((metadata) => ({
      metadata,
      comparison: [],
      provenance: {
        provider: metadata.provider,
        queryType: 'doi_lookup',
        query: { doi: '10.5555/synthetic' },
        endpoint: 'http://127.0.0.1/works',
        requestedAt: '2026-01-01T00:00:00.000Z',
        sourceKind: 'external_provider_result' as const,
      },
    }));
    const result = compareProviderRecords(records);
    expect(result.records).toBe(records);
    expect(result.differences).toEqual([
      {
        field: 'year',
        observations: [
          { provider: 'crossref', providerRecordId: '10.5555/synthetic', value: 2021 },
          { provider: 'openalex', providerRecordId: 'https://openalex.org/W123', value: 2020 },
        ],
      },
    ]);
    expect(result).toMatchObject({ recommendation: 'human_verification_recommended', claimSupport: 'cannot_be_verified_from_metadata_alone' });
  });
});
