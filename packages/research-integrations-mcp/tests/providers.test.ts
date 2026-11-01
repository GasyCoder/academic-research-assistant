import { afterEach, describe, expect, it } from 'vitest';

import { providerResultSchema } from '../src/contracts.js';
import { compareProviderRecords } from '../src/metadata.js';
import { createIntegrations } from '../src/service.js';
import { closeAll, consent, crossrefWork, fakeServer, json, library, openalexWork, setup, track, zoteroItem } from './helpers.js';

afterEach(closeAll);

const FORBIDDEN_VERDICTS = /\b(fake|fabricat|fraud|does not exist|nonexistent|invalid reference)/iu;

describe('network consent', () => {
  it('makes no request on construction or without per-call consent, even after a consented cached call', async () => {
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }), {
      ARA_OPENALEX_API_KEY: 'synthetic-openalex-key',
    });
    expect(server.requests).toHaveLength(0);
    const first = await service.crossrefLookup({ doi: '10.5555/synthetic' });
    expect(first).toMatchObject({
      status: 'verification_not_performed',
      records: [],
      error: { code: 'NETWORK_CONSENT_REQUIRED' },
      doiVerification: { syntax: 'recognized', providerRecord: 'not_checked' },
    });
    await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    const denied = await service.crossrefLookup({ doi: '10.5555/synthetic' });
    expect(denied.status).toBe('verification_not_performed');
    expect(denied.records).toEqual([]);
    expect(denied).not.toHaveProperty('cacheHit');
    for (const call of [
      service.crossrefSearch({ title: 'Synthetic Methods' }),
      service.openalexLookup({ id: 'W123' }),
      service.openalexSearch({ title: 'Synthetic Methods' }),
      service.zoteroGet({ libraryType: 'users', libraryId: '123', itemKey: 'ABCD1234' }),
      service.zoteroSearch({ libraryType: 'users', libraryId: '123', query: 'Synthetic' }),
    ]) {
      expect((await call).status).toBe('verification_not_performed');
    }
    expect(server.requests).toHaveLength(1);
  });

  it('does not send or correct an unrecognized DOI', async () => {
    const { service, server } = await setup();
    for (const result of [
      await service.crossrefLookup({ doi: 'SYNTHETIC_PRIVATE_MARKER', ...consent }),
      await service.openalexLookup({ id: 'not a doi', ...consent }),
    ]) {
      expect(result).toMatchObject({
        status: 'verification_not_performed',
        doiVerification: { syntax: 'not_recognized', providerRecord: 'not_checked', metadataAgreement: 'not_compared' },
        error: { code: 'DOI_NOT_RECOGNIZED' },
      });
      expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
    }
    expect(server.requests).toHaveLength(0);
  });
});

describe('Crossref', () => {
  it('A: returns an exact DOI record with provenance and separate DOI verification levels', async () => {
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }), {
      ARA_CROSSREF_CONTACT: 'contact@example.invalid',
    });
    const result = await service.crossrefLookup({
      doi: 'https://doi.org/10.5555/SYNTHETIC',
      expected: { title: 'Synthetic Methods', year: 2021 },
      ...consent,
    });
    expect(providerResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      provider: 'crossref',
      status: 'exact_match',
      doiVerification: { syntax: 'recognized', providerRecord: 'found', metadataAgreement: 'all_compared_fields_matched' },
      interpretation: { claimSupport: 'cannot_be_verified_from_metadata_alone' },
      provenance: { queryType: 'doi_lookup', query: { doi: '10.5555/synthetic' }, sourceKind: 'external_provider_result' },
    });
    expect(result.records[0]!.provenance).toMatchObject({ canonicalId: '10.5555/synthetic', retrievedAt: expect.any(String) });
    expect(result.provenance.endpoint).toMatch(/\/v1\/works\/10\.5555%2Fsynthetic$/u);
    expect(server.requests[0]).toMatchObject({ method: 'GET', url: '/v1/works/10.5555%2Fsynthetic?mailto=contact%40example.invalid' });
    expect(server.requests[0]!.headers['user-agent']).toMatch(/^academic-research-assistant\/\d+\.\d+\.\d+ .* mailto:contact@example\.invalid$/u);
    expect(JSON.stringify(result)).not.toContain('contact@example.invalid');
  });

  it('keeps a DOI with path syntax inside one encoded path segment', async () => {
    const { service, server } = await setup((_req, res) => json(res, {}, 404));
    await service.crossrefLookup({ doi: '10.5555/../../admin', ...consent });
    expect(server.requests[0]!.url).toBe('/v1/works/10.5555%2F..%2F..%2Fadmin');
  });

  it('reports a metadata mismatch from the cache without a second request', async () => {
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }));
    await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    const mismatch = await service.crossrefLookup({ doi: '10.5555/synthetic', expected: { title: 'Different title', year: 2021 }, ...consent });
    expect(mismatch).toMatchObject({
      status: 'metadata_mismatch',
      cacheHit: true,
      doiVerification: { providerRecord: 'found', metadataAgreement: 'mismatch_observed' },
    });
    expect(server.requests).toHaveLength(1);
  });

  it('keeps a print/online year difference inconclusive rather than a mismatch', async () => {
    const { service } = await setup((_req, res) => json(res, { message: crossrefWork() }));
    const result = await service.crossrefLookup({ doi: '10.5555/synthetic', expected: { year: 2020 }, ...consent });
    expect(result).toMatchObject({ status: 'exact_match', doiVerification: { metadataAgreement: 'inconclusive' } });
    expect(result.records[0]!.comparison[0]).toMatchObject({ field: 'year', state: 'inconclusive' });
  });

  it('refuses a contradictory expected DOI instead of reconciling it', async () => {
    const { service, server } = await setup();
    await expect(service.crossrefLookup({ doi: '10.5555/synthetic', expected: { doi: '10.5555/different' }, ...consent })).rejects.toThrow(
      'Invalid integration input',
    );
    await expect(service.openalexLookup({ id: '10.5555/synthetic', expected: { doi: '10.5555/different' }, ...consent })).rejects.toThrow(
      'Invalid integration input',
    );
    expect(server.requests).toHaveLength(0);
  });

  it('B: reports a provider-specific not_found, never a fabrication verdict', async () => {
    const { service } = await setup((_req, res) => json(res, { status: 'error', message: 'SYNTHETIC_UPSTREAM_BODY' }, 404));
    const result = await service.crossrefLookup({ doi: '10.5555/absent', ...consent });
    expect(result).toMatchObject({
      provider: 'crossref',
      status: 'not_found',
      records: [],
      doiVerification: { syntax: 'recognized', providerRecord: 'not_found', metadataAgreement: 'not_compared' },
    });
    expect(result.interpretation.note).toContain('No matching Crossref record was found for this query');
    expect(result.interpretation.note).toContain('not evidence that the work does not exist');
    expect(result.interpretation.note.replace('not evidence that the work does not exist', '')).not.toMatch(FORBIDDEN_VERDICTS);
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_UPSTREAM_BODY');
  });

  it('D: returns bounded ambiguous candidates with comparison evidence and paging', async () => {
    const { service, server } = await setup((_req, res) =>
      json(res, { message: { items: [crossrefWork(), crossrefWork({ DOI: '10.5555/other', title: ['Synthetic Methods Revisited'] })], 'total-results': 40 } }),
    );
    const result = await service.crossrefSearch({ title: 'Synthetic Methods', author: 'Ada Example', year: 2021, limit: 2, ...consent });
    expect(result.status).toBe('ambiguous');
    expect(result.records.map((r) => r.metadata.providerRecordId)).toEqual(['10.5555/synthetic', '10.5555/other']);
    expect(result.records[1]!.comparison.find((c) => c.field === 'title')!.state).toBe('mismatch');
    expect(result.pagination).toEqual({ limit: 2, hasMore: true, capped: false, nextStart: 2 });
    const url = new URL(server.requests[0]!.url, 'http://127.0.0.1');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      'query.title': 'Synthetic Methods',
      'query.author': 'Ada Example',
      filter: 'from-pub-date:2020-01-01,until-pub-date:2022-12-31',
      rows: '3',
      offset: '0',
    });
    expect(url.searchParams.get('select')).not.toContain('abstract');
    await expect(service.crossrefSearch({ title: 'x', limit: 21, ...consent })).rejects.toThrow('Invalid integration input');
    await expect(service.crossrefSearch({ title: 'x', start: 10_001, ...consent })).rejects.toThrow('Invalid integration input');
  });

  it('never calls a search result an exact match, and a lone result with more pages stays ambiguous', async () => {
    const one = await setup((_req, res) => json(res, { message: { items: [crossrefWork()], 'total-results': 1 } }));
    expect((await one.service.crossrefSearch({ title: 'Synthetic Methods', ...consent })).status).toBe('candidate_match');
    const more = await setup((_req, res) => json(res, { message: { items: [crossrefWork(), crossrefWork({ DOI: '10.5555/b' })], 'total-results': 9 } }));
    const result = await more.service.crossrefSearch({ title: 'Synthetic Methods', limit: 1, ...consent });
    expect(result.records).toHaveLength(1);
    expect(result.status).toBe('ambiguous');
    const none = await setup((_req, res) => json(res, { message: { items: [], 'total-results': 0 } }));
    expect((await none.service.crossrefSearch({ title: 'Synthetic Methods', ...consent })).status).toBe('not_found');
  });

  it.each([
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [403, 'unavailable'],
    [400, 'unavailable'],
  ] as const)('isolates HTTP %s as %s without quoting the upstream body', async (status, expected) => {
    const { service } = await setup((_req, res) => json(res, { error: 'SYNTHETIC_PRIVATE_UPSTREAM_BODY' }, status));
    const result = await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    expect(result.status).toBe(expected);
    expect(result.records).toEqual([]);
    expect(result.doiVerification?.providerRecord).toBe('not_checked');
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE');
    expect(result.interpretation.note).not.toMatch(FORBIDDEN_VERDICTS);
  });
});

describe('OpenAlex', () => {
  it('looks up a DOI with a bearer key in a header only, keeping W id and DOI distinct', async () => {
    const { service, server } = await setup((_req, res) => json(res, openalexWork()), { ARA_OPENALEX_API_KEY: 'synthetic-openalex-key' });
    const result = await service.openalexLookup({ id: 'doi:10.5555/SYNTHETIC', ...consent });
    expect(result).toMatchObject({ status: 'exact_match', doiVerification: { syntax: 'recognized', providerRecord: 'found' } });
    expect(result.records[0]!.metadata).toMatchObject({ providerRecordId: 'https://openalex.org/W123', doi: '10.5555/synthetic' });
    const request = server.requests[0]!;
    expect(request.url.startsWith('/works/doi%3A10.5555%2Fsynthetic?select=')).toBe(true);
    expect(request.headers.authorization).toBe('Bearer synthetic-openalex-key');
    expect(request.url).not.toContain('synthetic-openalex-key');
    expect(JSON.stringify(result)).not.toContain('synthetic-openalex-key');
  });

  it('looks up W ids without treating them as DOIs and rejects URLs as identifiers', async () => {
    const { service, server } = await setup((_req, res) => json(res, openalexWork()));
    const result = await service.openalexLookup({ id: 'https://openalex.org/w123', ...consent });
    expect(result).toMatchObject({ status: 'exact_match', provenance: { queryType: 'work_id_lookup', query: { openalexId: 'https://openalex.org/W123' } } });
    expect(result).not.toHaveProperty('doiVerification');
    expect(server.requests[0]!.url.startsWith('/works/W123?')).toBe(true);
    const url = await service.openalexLookup({ id: 'http://127.0.0.1/admin', ...consent });
    expect(url.error?.code).toBe('DOI_NOT_RECOGNIZED');
    expect(server.requests).toHaveLength(1);
  });

  it('follows a same-origin merged-id redirect and reports a candidate, not an exact match', async () => {
    const { service, server } = await setup((req, res) => {
      if (req.url!.startsWith('/works/W111')) {
        res.writeHead(301, { Location: '/works/W123?select=id' });
        res.end();
      } else {
        json(res, openalexWork());
      }
    }, { ARA_OPENALEX_API_KEY: 'synthetic-openalex-key' });
    const result = await service.openalexLookup({ id: 'W111', ...consent });
    expect(result).toMatchObject({ status: 'candidate_match', provenance: { redirected: true } });
    expect(result.records[0]!.metadata.providerRecordId).toBe('https://openalex.org/W123');
    expect(server.requests.map((r) => r.headers.authorization)).toEqual(['Bearer synthetic-openalex-key', 'Bearer synthetic-openalex-key']);
  });

  it('searches the title only, never sends the author, and retains ambiguity with capped pages', async () => {
    const { service, server } = await setup((_req, res) =>
      json(res, { results: [openalexWork(), openalexWork({ id: 'https://openalex.org/W456' })], meta: { count: 100 } }),
    );
    const result = await service.openalexSearch({ title: 'Synthetic Methods', author: 'Ada Example', year: 2020, limit: 2, page: 10, ...consent });
    expect(result.status).toBe('ambiguous');
    expect(result.pagination).toEqual({ limit: 2, hasMore: true, capped: true });
    const url = new URL(server.requests[0]!.url, 'http://127.0.0.1');
    expect(url.searchParams.get('search.title')).toBe('Synthetic Methods');
    expect(url.searchParams.get('filter')).toBe('publication_year:2019-2021');
    expect(url.searchParams.has('search')).toBe(false);
    expect(server.requests[0]!.url).not.toContain('Ada');
    expect(result.provenance.query).not.toHaveProperty('author');
    expect(result.records[0]!.comparison.find((c) => c.field === 'author')!.state).toBe('matched');
  });

  it.each([
    [404, 'not_found'],
    [429, 'rate_limited'],
  ] as const)('reports HTTP %s as a provider-specific %s', async (status, expected) => {
    const { service } = await setup((_req, res) => json(res, {}, status));
    expect((await service.openalexLookup({ id: 'W123', ...consent })).status).toBe(expected);
  });

  it.each(['crossref', 'openalex'] as const)('refuses a malformed %s structure rather than reporting not found', async (provider) => {
    const { service } = await setup((_req, res) => json(res, { unexpected: [] }));
    const result = provider === 'crossref'
      ? await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent })
      : await service.openalexLookup({ id: 'W123', ...consent });
    expect(result).toMatchObject({ status: 'unavailable', error: { code: 'INVALID_RESPONSE' } });
  });
});

describe('provider independence', () => {
  it('E: keeps OpenAlex evidence when Crossref fails', async () => {
    const { service } = await setup((req, res) => (req.url!.startsWith('/v1/') ? json(res, {}, 500) : json(res, openalexWork())));
    const crossref = await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    const openalex = await service.openalexLookup({ id: '10.5555/synthetic', ...consent });
    expect(crossref).toMatchObject({ provider: 'crossref', status: 'unavailable' });
    expect(openalex).toMatchObject({ provider: 'openalex', status: 'exact_match' });
  });

  it('C: preserves a Crossref/OpenAlex year disagreement with both provenances', async () => {
    const { service } = await setup((req, res) => (req.url!.startsWith('/v1/') ? json(res, { message: crossrefWork() }) : json(res, openalexWork())));
    const crossref = await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    const openalex = await service.openalexLookup({ id: '10.5555/synthetic', ...consent });
    const comparison = compareProviderRecords([...crossref.records, ...openalex.records]);
    expect(comparison.records.map((r) => r.provenance.provider)).toEqual(['crossref', 'openalex']);
    expect(comparison.differences).toEqual([expect.objectContaining({ field: 'year' })]);
    expect(comparison.recommendation).toBe('human_verification_recommended');
    expect(crossref.records[0]!.metadata.dates).toMatchObject({ 'published-online': '2020-12-1' });
  });
});

describe('Zotero', () => {
  it('G: reads a public library with API v3 and without a key, even when one is configured', async () => {
    const { service, server } = await setup((_req, res) => json(res, zoteroItem()), { ARA_ZOTERO_API_KEY: 'synthetic-zotero-key' });
    const result = await service.zoteroGet({ ...library, itemKey: 'ABCD1234' });
    expect(result).toMatchObject({ status: 'exact_match', provenance: { query: { library: 'users/123', itemKey: 'ABCD1234', access: 'public' } } });
    expect(server.requests[0]).toMatchObject({ method: 'GET', url: '/users/123/items/ABCD1234?format=json' });
    expect(server.requests[0]!.headers['zotero-api-version']).toBe('3');
    expect(server.requests[0]!.headers['zotero-api-key']).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE/u);
  });

  it('H: refuses a private web read without a configured key before any request', async () => {
    const { service, server } = await setup((_req, res) => json(res, zoteroItem()));
    const result = await service.zoteroGet({ ...library, itemKey: 'ABCD1234', access: 'private' });
    expect(result).toMatchObject({ status: 'authentication_required', records: [], error: { code: 'AUTHENTICATION_REQUIRED' } });
    expect(server.requests).toHaveLength(0);
  });

  it('reports a public read of a library that is actually private as authentication_required', async () => {
    const { service } = await setup((_req, res) => json(res, { message: 'SYNTHETIC_PRIVATE_BODY' }, 403));
    const result = await service.zoteroGet({ ...library, itemKey: 'ABCD1234' });
    expect(result.status).toBe('authentication_required');
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_BODY');
  });

  it('I: sends the key only in the private header and redacts hostile echoes; nothing is cached', async () => {
    const secret = 'synthetic-zotero-secret';
    const { service, server } = await setup((_req, res) => json(res, zoteroItem({ title: secret, url: `https://example.invalid/?key=${secret}` })), {
      ARA_ZOTERO_API_KEY: secret,
    });
    const result = await service.zoteroGet({ ...library, itemKey: 'ABCD1234', access: 'private' });
    expect(server.requests[0]!.headers['zotero-api-key']).toBe(secret);
    expect(server.requests[0]!.headers.authorization).toBeUndefined();
    expect(server.requests[0]!.url).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.records[0]!.metadata.title).toBe('[REDACTED]');
    await service.zoteroGet({ ...library, itemKey: 'ABCD1234', access: 'private' });
    expect(server.requests).toHaveLength(2);
  });

  it('rejects an item returned under another key', async () => {
    const { service } = await setup((_req, res) => json(res, { ...zoteroItem(), key: 'EFGH5678' }));
    expect(await service.zoteroGet({ ...library, itemKey: 'ABCD1234' })).toMatchObject({ status: 'unavailable', error: { code: 'INVALID_RESPONSE' } });
  });

  it('pages a bounded search with start/limit, ignores Link headers and returns no notes or abstracts', async () => {
    const { service, server } = await setup((_req, res) => {
      res.setHeader('Total-Results', '10');
      res.setHeader('Link', '<https://example.invalid/next>; rel="next"');
      json(res, [zoteroItem()]);
    });
    const result = await service.zoteroSearch({ ...library, query: 'Synthetic', limit: 1, start: 2 });
    expect(result.status).toBe('ambiguous');
    expect(result.pagination).toEqual({ limit: 1, hasMore: true, capped: false, nextStart: 3 });
    const url = new URL(server.requests[0]!.url, 'http://127.0.0.1');
    expect(url.pathname).toBe('/users/123/items/top');
    expect(Object.fromEntries(url.searchParams)).toEqual({ format: 'json', q: 'Synthetic', qmode: 'titleCreatorYear', limit: '1', start: '2' });
    expect(server.requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE/u);
    await expect(service.zoteroSearch({ ...library, query: 'x', limit: 100 })).rejects.toThrow('Invalid integration input');
  });

  it('caps returned items even if the provider ignores the limit', async () => {
    const { service } = await setup((_req, res) => json(res, Array.from({ length: 30 }, () => zoteroItem())));
    const result = await service.zoteroSearch({ ...library, query: 'Synthetic', limit: 3 });
    expect(result.records).toHaveLength(3);
    expect(result.pagination?.hasMore).toBe(true);
  });

  it('needs an operator opt-in for the local API, uses the fixed loopback base and never sends the web key', async () => {
    const server = await fakeServer((_req, res) => json(res, zoteroItem()));
    track(server.close);
    const tests = { minimumIntervalMs: 0, testBases: { zoteroLocal: `${server.url}api/` } };
    const off = createIntegrations({}, tests);
    expect((await off.zoteroGet({ ...library, libraryId: '0', itemKey: 'ABCD1234', mode: 'local' })).status).toBe('verification_not_performed');
    expect(server.requests).toHaveLength(0);
    const on = createIntegrations({ ARA_ZOTERO_LOCAL: '1', ARA_ZOTERO_API_KEY: 'synthetic-zotero-secret' }, tests);
    const result = await on.zoteroGet({ ...library, libraryId: '0', itemKey: 'ABCD1234', mode: 'local', access: 'private' });
    expect(result).toMatchObject({ status: 'exact_match', provenance: { sourceKind: 'local_library_result' } });
    expect(server.requests[0]!.url).toBe('/api/users/0/items/ABCD1234?format=json');
    expect(server.requests[0]!.headers['zotero-api-key']).toBeUndefined();
  });

  it('reports a disabled or unreachable local API as unavailable, never as a key prompt', async () => {
    const { service } = await setup((_req, res) => json(res, {}, 403), { ARA_ZOTERO_LOCAL: '1' });
    expect((await service.zoteroGet({ ...library, itemKey: 'ABCD1234', mode: 'local' })).status).toBe('unavailable');
    const closed = createIntegrations({ ARA_ZOTERO_LOCAL: '1', ARA_INTEGRATIONS_TIMEOUT_MS: '500' }, { testBases: { zoteroLocal: 'http://127.0.0.1:9/api/' } });
    expect((await closed.zoteroGet({ ...library, itemKey: 'ABCD1234', mode: 'local' })).status).toBe('unavailable');
  });
});
