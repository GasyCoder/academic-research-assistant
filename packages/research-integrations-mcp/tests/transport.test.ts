import { afterEach, describe, expect, it } from 'vitest';

import { closeAll, consent, crossrefWork, fakeServer, json, library, openalexWork, setup, track, zoteroItem } from './helpers.js';

afterEach(closeAll);

type Service = Awaited<ReturnType<typeof setup>>['service'];
const lookup = (service: Service, provider: 'crossref' | 'openalex', doi = '10.5555/synthetic') =>
  provider === 'crossref' ? service.crossrefLookup({ doi, ...consent }) : service.openalexLookup({ id: doi, ...consent });

describe.each(['crossref', 'openalex'] as const)('%s through the bounded HTTP client', (provider) => {
  it('sanitizes malformed JSON after exactly one request', async () => {
    const { service, server } = await setup((_req, res) => res.end('<html>SYNTHETIC_PRIVATE_HTML</html>'));
    const result = await lookup(service, provider);
    expect(result).toMatchObject({ status: 'unavailable', error: { code: 'INVALID_RESPONSE' } });
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_HTML');
    expect(server.requests).toHaveLength(1);
  });

  it('refuses invalid UTF-8', async () => {
    const { service } = await setup((_req, res) => {
      res.writeHead(200);
      res.end(Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]));
    });
    expect((await lookup(service, provider)).error?.code).toBe('INVALID_RESPONSE');
  });

  it('times out waiting for headers, without hanging or retrying', async () => {
    const { service, server } = await setup(() => {}, { ARA_INTEGRATIONS_TIMEOUT_MS: '100' });
    const result = await lookup(service, provider);
    expect(result).toMatchObject({ status: 'unavailable', error: { code: 'TIMEOUT' } });
    expect(server.requests).toHaveLength(1);
  });

  it('keeps the timeout active while a body is streaming', async () => {
    const { service } = await setup((_req, res) => {
      res.writeHead(200);
      res.write('{"unfinished":');
    }, { ARA_INTEGRATIONS_TIMEOUT_MS: '100' });
    expect((await lookup(service, provider)).error?.code).toBe('TIMEOUT');
  });

  it('P: bounds a chunked body by the bytes actually received', async () => {
    const { service } = await setup((_req, res) => {
      res.writeHead(200);
      res.write('x'.repeat(1500));
      res.end('x'.repeat(1500));
    }, { ARA_INTEGRATIONS_RESPONSE_BYTES: '1024' });
    const result = await lookup(service, provider);
    expect(result).toMatchObject({ status: 'unavailable', records: [], error: { code: 'RESPONSE_TOO_LARGE' } });
  });

  it('P: rejects an oversized Content-Length before reading the body', async () => {
    const { service } = await setup((_req, res) => {
      res.writeHead(200, { 'Content-Length': '10000000' });
      res.flushHeaders();
    }, { ARA_INTEGRATIONS_RESPONSE_BYTES: '1024' });
    expect((await lookup(service, provider)).error?.code).toBe('RESPONSE_TOO_LARGE');
  });

  it('F: honors Retry-After on 429 without retrying, then refuses early calls locally', async () => {
    const { service, server } = await setup((_req, res) => {
      res.setHeader('Retry-After', '7');
      json(res, {}, 429);
    });
    const first = await lookup(service, provider);
    const second = await lookup(service, provider);
    expect(first).toMatchObject({ status: 'rate_limited', error: { code: 'RATE_LIMITED', httpStatus: 429 } });
    expect(first.error?.retryAfterMs).toBeGreaterThanOrEqual(6900);
    expect(second).toMatchObject({ status: 'rate_limited', error: { code: 'CLIENT_COOLDOWN' } });
    expect(server.requests).toHaveLength(1);
  });

  it('F: starts a cooldown on a 429 that gives no delay', async () => {
    const { service, server } = await setup((_req, res) => json(res, {}, 429));
    expect((await lookup(service, provider)).error?.retryAfterMs).toBeGreaterThanOrEqual(900);
    expect((await lookup(service, provider)).error?.code).toBe('CLIENT_COOLDOWN');
    expect(server.requests).toHaveLength(1);
  });
});

describe('redirects', () => {
  it('I: never follows a cross-origin redirect of a credentialed Zotero request', async () => {
    const target = await fakeServer();
    track(target.close);
    const { service, server } = await setup((_req, res) => {
      res.writeHead(302, { Location: `${target.url}collect?key=synthetic-zotero-key` });
      res.end('SYNTHETIC_PRIVATE_BODY');
    }, { ARA_ZOTERO_API_KEY: 'synthetic-zotero-key' });
    const result = await service.zoteroGet({ ...library, itemKey: 'ABCD1234', access: 'private' });
    expect(result).toMatchObject({ status: 'unavailable', error: { code: 'REDIRECT_BLOCKED', httpStatus: 302 } });
    expect(target.requests).toEqual([]);
    expect(server.requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/synthetic-zotero-key|SYNTHETIC_PRIVATE_BODY|collect/u);
  });

  it('never follows a cross-origin OpenAlex redirect, even though same-origin ones are allowed', async () => {
    const target = await fakeServer((_req, res) => json(res, openalexWork()));
    track(target.close);
    const { service } = await setup((_req, res) => {
      res.writeHead(301, { Location: `${target.url}works/W123` });
      res.end();
    }, { ARA_OPENALEX_API_KEY: 'synthetic-openalex-key' });
    expect((await service.openalexLookup({ id: 'W111', ...consent })).error?.code).toBe('REDIRECT_BLOCKED');
    expect(target.requests).toEqual([]);
  });

  it('treats a protocol-relative redirect as cross-origin', async () => {
    const target = await fakeServer((_req, res) => json(res, openalexWork()));
    track(target.close);
    const { service } = await setup((_req, res) => {
      res.writeHead(301, { Location: `//${new URL(target.url).host}/works/W123` });
      res.end();
    });
    expect((await service.openalexLookup({ id: 'W111', ...consent })).error?.code).toBe('REDIRECT_BLOCKED');
    expect(target.requests).toEqual([]);
  });

  it('bounds same-origin OpenAlex redirects', async () => {
    const { service, server } = await setup((req, res) => {
      res.writeHead(301, { Location: `/works/W${Number(/W(\d+)/u.exec(req.url!)![1]) + 1}` });
      res.end();
    });
    expect((await service.openalexLookup({ id: 'W1', ...consent })).error?.code).toBe('REDIRECT_BLOCKED');
    expect(server.requests).toHaveLength(3);
  });

  it('rejects even same-origin redirects for providers that need none', async () => {
    const { service, server } = await setup((_req, res) => {
      res.writeHead(307, { Location: '/v1/works/other' });
      res.end();
    });
    expect((await lookup(service, 'crossref')).error?.code).toBe('REDIRECT_BLOCKED');
    expect(server.requests).toHaveLength(1);
  });
});

describe('Zotero rate limiting', () => {
  it.each([
    [403, 'authentication_required'],
    [429, 'rate_limited'],
    [503, 'unavailable'],
  ] as const)('sanitizes private HTTP %s and honors the longest of Backoff and Retry-After', async (status, expected) => {
    const { service, server } = await setup((_req, res) => {
      res.setHeader('Backoff', '8');
      res.setHeader('Retry-After', '6');
      json(res, { message: 'synthetic-zotero-key' }, status);
    }, { ARA_ZOTERO_API_KEY: 'synthetic-zotero-key' });
    const args = { ...library, libraryType: 'groups', itemKey: 'ABCD1234', access: 'private' } as const;
    const result = await service.zoteroGet(args);
    expect(result.status).toBe(expected);
    expect(JSON.stringify(result)).not.toContain('synthetic-zotero-key');
    const next = await service.zoteroGet(args);
    expect(next.error?.code).toBe('CLIENT_COOLDOWN');
    expect(next.error?.retryAfterMs).toBeGreaterThanOrEqual(7800);
    expect(server.requests).toHaveLength(1);
  });

  it('honors a Backoff header on a successful response', async () => {
    const { service, server } = await setup((_req, res) => {
      res.setHeader('Backoff', '5');
      json(res, zoteroItem());
    });
    const args = { ...library, itemKey: 'ABCD1234' } as const;
    expect((await service.zoteroGet(args)).status).toBe('exact_match');
    expect((await service.zoteroGet(args)).error?.code).toBe('CLIENT_COOLDOWN');
    expect(server.requests).toHaveLength(1);
  });

  it('accepts Retry-After as an HTTP date', async () => {
    const now = 1_800_000_000_000;
    const { service } = await setup((_req, res) => {
      res.setHeader('Retry-After', new Date(now + 12_000).toUTCString());
      json(res, {}, 503);
    }, {}, { now: () => now });
    expect((await lookup(service, 'crossref')).error?.retryAfterMs).toBe(12_000);
  });
});

describe('pacing, queueing and cache', () => {
  it('waits a short pacing interval instead of failing a sequential call', async () => {
    const waits: number[] = [];
    let now = 1000;
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }), {}, {
      minimumIntervalMs: 250,
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });
    expect((await lookup(service, 'crossref', '10.5555/a')).status).toBe('candidate_match');
    expect((await lookup(service, 'crossref', '10.5555/b')).status).toBe('candidate_match');
    expect(waits).toEqual([250]);
    expect(server.requests).toHaveLength(2);
  });

  it('follows Crossref rate-limit headers for spacing', async () => {
    const waits: number[] = [];
    let now = 1000;
    const { service } = await setup((_req, res) => {
      res.setHeader('x-rate-limit-limit', '2');
      res.setHeader('x-rate-limit-interval', '1s');
      json(res, { message: crossrefWork() });
    }, {}, { now: () => now, sleep: async (ms) => { waits.push(ms); now += ms; } });
    await lookup(service, 'crossref', '10.5555/a');
    await lookup(service, 'crossref', '10.5555/b');
    expect(waits).toEqual([500]);
  });

  it('runs concurrent calls to one origin one at a time and refuses beyond a short queue', async () => {
    let active = 0;
    let peak = 0;
    const { service, server } = await setup((_req, res) => {
      active += 1;
      peak = Math.max(peak, active);
      setTimeout(() => {
        active -= 1;
        json(res, { message: crossrefWork() });
      }, 20);
    });
    const results = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => lookup(service, 'crossref', `10.5555/${s}`)));
    expect(peak).toBe(1);
    expect(results.filter((r) => r.records.length === 1)).toHaveLength(4);
    expect(results.filter((r) => r.error?.code === 'BUSY')).toHaveLength(2);
    expect(server.requests).toHaveLength(4);
  });

  it('answers a queued identical public request from the cache', async () => {
    const { service, server } = await setup((_req, res) => setTimeout(() => json(res, { message: crossrefWork() }), 20));
    const [a, b] = await Promise.all([lookup(service, 'crossref'), lookup(service, 'crossref')]);
    expect([a.cacheHit, b.cacheHit]).toEqual([false, true]);
    expect(server.requests).toHaveLength(1);
  });

  it('bounds the public cache by TTL, keeps the original retrieval time and isolates mutations', async () => {
    let now = 1_800_000_000_000;
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }), { ARA_INTEGRATIONS_CACHE_TTL_MS: '1000' }, { now: () => now });
    const a = await lookup(service, 'crossref');
    a.records[0]!.metadata.title = 'mutated';
    const b = await lookup(service, 'crossref');
    expect(b.cacheHit).toBe(true);
    expect(b.records[0]!.metadata.title).toBe('Synthetic Methods');
    expect(b.provenance.retrievedAt).toBe(a.provenance.retrievedAt);
    now += 1001;
    expect((await lookup(service, 'crossref')).cacheHit).toBe(false);
    expect(server.requests).toHaveLength(2);
  });

  it('can disable the cache', async () => {
    const { service, server } = await setup((_req, res) => json(res, { message: crossrefWork() }), { ARA_INTEGRATIONS_CACHE_TTL_MS: '0' });
    await lookup(service, 'crossref');
    await lookup(service, 'crossref');
    expect(server.requests).toHaveLength(2);
  });

  it('never fetches provider-returned URLs and redacts encoded secret echoes', async () => {
    const secret = 'synthetic~openalex~key';
    const { service, server } = await setup((_req, res) =>
      json(res, openalexWork({ title: secret, primary_location: { landing_page_url: `https://example.invalid/${encodeURIComponent(secret)}` } })),
    { ARA_OPENALEX_API_KEY: secret });
    const result = await lookup(service, 'openalex');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(encodeURIComponent(secret));
    expect(server.requests).toHaveLength(1);
  });
});
