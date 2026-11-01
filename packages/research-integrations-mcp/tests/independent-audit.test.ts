import { afterEach, describe, expect, it } from 'vitest';

import { containsSecret } from '../src/config.js';
import { LIMITS, providerResultSchema, type EvidenceRecord } from '../src/contracts.js';
import { compareMetadata, compareProviderRecords, crossrefMetadata, zoteroMetadata } from '../src/metadata.js';
import { closeAll, consent, crossrefWork, json, openalexWork, setup, zoteroItem } from './helpers.js';

afterEach(closeAll);

describe('independent transport and privacy regressions', () => {
  it.each([4, 12])('redacts credential echoes behind %i percent-encoding layers', async layers => {
    const secret = 'synthetic-zotero-secret';
    let encoded = Array.from(secret, c => `%${c.charCodeAt(0).toString(16)}`).join('');
    for (let n = 1; n < layers; n++) encoded = encodeURIComponent(encoded);
    const { service } = await setup((_req, res) => json(res, zoteroItem({ url: `https://example.invalid/?key=${encoded}` })),
      { ARA_ZOTERO_API_KEY: secret });
    const result = await service.zoteroGet({ libraryType: 'users', libraryId: '123', itemKey: 'ABCD1234', access: 'private', ...consent });
    expect(providerResultSchema.safeParse(result).success).toBe(true);
    expect(result.records[0].metadata.url).toBe('[REDACTED]');
    expect(containsSecret(`malformed%ZZ:${encoded}`, [secret])).toBe(true);
  });

  it('paces each same-origin OpenAlex redirect request', async () => {
    let now = 1000;
    const waits: number[] = [];
    const { service, server } = await setup((req, res) => {
      if (req.url!.includes('W111')) { res.writeHead(302, { Location: '/works/W123' }); res.end(); }
      else json(res, openalexWork());
    }, {}, { minimumIntervalMs: 250, now: () => now, sleep: async ms => { waits.push(ms); now += ms; } });
    expect((await service.openalexLookup({ id: 'W111', ...consent })).status).toBe('candidate_match');
    expect(server.requests).toHaveLength(2);
    expect(waits).toEqual([250]);
  });

  it('honors a provider Backoff before following a same-origin redirect', async () => {
    const { service, server } = await setup((_req, res) => {
      res.writeHead(302, { Location: '/works/W123', Backoff: '30' }); res.end();
    }, {}, { minimumIntervalMs: 0, now: () => 1000 });
    const result = await service.openalexLookup({ id: 'W111', ...consent });
    expect(result).toMatchObject({ status: 'rate_limited', records: [], error: { code: 'CLIENT_COOLDOWN', retryAfterMs: 30_000 } });
    expect(server.requests).toHaveLength(1);
  });

  it('keeps the request timeout active during redirect pacing', async () => {
    const { service, server } = await setup((_req, res) => {
      res.writeHead(302, { Location: '/works/W123' }); res.end();
    }, { ARA_INTEGRATIONS_TIMEOUT_MS: '100' }, {
      minimumIntervalMs: 250, now: () => 1000, sleep: () => new Promise<void>(() => {}),
    });
    const result = await service.openalexLookup({ id: 'W111', ...consent });
    expect(result.error?.code).toBe('TIMEOUT');
    expect(server.requests).toHaveLength(1);
  });

  it('honors a two-day Retry-After without permitting an early call after one day', async () => {
    let now = 1_800_000_000_000;
    const { service, server } = await setup((_req, res) => {
      res.setHeader('Retry-After', '172800'); json(res, {}, 503);
    }, {}, { now: () => now });
    const first = await service.crossrefLookup({ doi: '10.5555/first', ...consent });
    expect(first.error?.retryAfterMs).toBe(172_800_000);
    now += 86_400_001;
    const next = await service.crossrefLookup({ doi: '10.5555/next', ...consent });
    expect(next.error?.code).toBe('CLIENT_COOLDOWN');
    expect(next.error?.retryAfterMs).toBe(86_399_999);
    expect(server.requests).toHaveLength(1);
  });

  it('ignores fractional rate counts whose quotient overflows', async () => {
    const { service, server } = await setup((_req, res) => {
      res.setHeader('x-rate-limit-limit', '1e-320'); res.setHeader('x-rate-limit-interval', '1s');
      json(res, { message: crossrefWork() });
    });
    await service.crossrefLookup({ doi: '10.5555/first', ...consent });
    const next = await service.crossrefLookup({ doi: '10.5555/next', ...consent });
    expect(providerResultSchema.safeParse(next).success).toBe(true);
    expect(next.error?.code).not.toBe('CLIENT_COOLDOWN');
    expect(server.requests).toHaveLength(2);
  });

  it('keeps an HTTP-date cooldown longer than a day', async () => {
    const now = 1_800_000_000_000;
    const { service } = await setup((_req, res) => {
      res.setHeader('Retry-After', new Date(now + 172_800_000).toUTCString()); json(res, {}, 503);
    }, {}, { now: () => now });
    const result = await service.crossrefLookup({ doi: '10.5555/synthetic', ...consent });
    expect(result.error?.retryAfterMs).toBe(172_800_000);
  });
});

describe('independent metadata regressions', () => {
  it('keeps DOI punctuation significant when comparing providers', () => {
    const records: EvidenceRecord[] = ['10.5555/alpha.', '10.5555/alpha'].map(doi => ({
      metadata: { provider: 'crossref', providerRecordId: doi, doi }, comparison: [], provenance: {
        provider: 'crossref', queryType: 'doi_lookup', query: { doi }, endpoint: 'https://example.invalid/works',
        requestedAt: '2026-11-01T00:00:00.000Z', sourceKind: 'external_provider_result',
      },
    }));
    const result = compareProviderRecords(records);
    expect(result.differences.map(d => d.field)).toEqual(['doi']);
    expect(result.recommendation).toBe('human_verification_recommended');
  });

  it.each([
    { expected: 'A. Example', author: { given: 'A.', family: 'Example' } },
    { expected: 'van der Example', author: { family: 'van der Example' } },
    { expected: 'A. Example', author: { name: 'A. Example' } },
  ])('keeps initial-only or family-only author agreement inconclusive: $expected', ({ expected, author }) => {
    const record = crossrefMetadata(crossrefWork({ author: [author] }));
    expect(compareMetadata({ author: expected }, record)[0].state).toBe('inconclusive');
  });

  it('does not certify all metadata fields when the identical provider name contains initials', async () => {
    const { service } = await setup((_req, res) => json(res, { message: crossrefWork({ author: [{ given: 'A.', family: 'Example' }] }) }));
    const result = await service.crossrefLookup({ doi: '10.5555/synthetic', expected: { author: 'A. Example' }, ...consent });
    expect(result.doiVerification?.metadataAgreement).toBe('inconclusive');
  });

  it('applies the metadata string bound to the raw Zotero DOI too', () => {
    const metadata = zoteroMetadata(zoteroItem({ DOI: 'x'.repeat(LIMITS.metadataText + 1) }), 'users/123');
    expect(metadata.identifiers?.doi).toBeUndefined();
    expect(metadata.omissions).toContain('FIELD_TOO_LONG:doi');
  });
});
