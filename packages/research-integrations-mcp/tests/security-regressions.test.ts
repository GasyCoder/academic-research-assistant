import { afterEach, expect, it } from 'vitest';
import { createIntegrations } from '../src/service.js';
import { providerResultSchema } from '../src/contracts.js';
import { crossrefWork, fakeServer, json, zoteroItem } from './helpers.js';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });
it('removes fully and partly percent-encoded credential echoes from URL metadata', async () => {
  const secret = 'synthetic-zotero-secret', encoded = Array.from(secret,c => `%${c.charCodeAt(0).toString(16)}`).join('');
  const mixed = Array.from(secret,(c,i) => i%2 ? c : `%${c.charCodeAt(0).toString(16).toUpperCase()}`).join('');
  const http = await fakeServer((_req,res) => json(res,zoteroItem({ url: `https://example.invalid/?key=${encoded}&other=${mixed}` })));
  closers.push(http.close);
  const service = createIntegrations({ ARA_ZOTERO_API_KEY: secret },{ testBases: { zotero: http.url } });
  const result = await service.zoteroGet({ libraryType: 'users',libraryId: '123',itemKey: 'ABCD1234',access: 'private',networkConsent: true });
  expect(providerResultSchema.safeParse(result).success).toBe(true);
  expect(decodeURIComponent(JSON.stringify(result))).not.toContain(secret);
  expect(result.records[0].metadata.url).toContain('[REDACTED]');
});
it('preserves contract property names when a credential equals a common field name', async () => {
  const http = await fakeServer((_req,res) => json(res,zoteroItem({ title: 'provider' })));closers.push(http.close);
  const service = createIntegrations({ ARA_ZOTERO_API_KEY: 'provider' },{ testBases: { zotero: http.url } });
  const result = await service.zoteroGet({ libraryType: 'users',libraryId: '123',itemKey: 'ABCD1234',access: 'private',networkConsent: true });
  expect(providerResultSchema.safeParse(result).success).toBe(true);
  expect(result.records[0].metadata).toMatchObject({ provider: 'zotero',providerRecordId: 'users/123/items/ABCD1234',title: '[REDACTED]' });
});
it('retains trusted protocol tags while redacting the same bytes echoed as free-form data', async () => {
  const http = await fakeServer((_req,res) => json(res,{ message: crossrefWork({ title: ['crossref'] }) }));closers.push(http.close);
  const service = createIntegrations({ ARA_ZOTERO_API_KEY: 'crossref' },{ testBases: { crossref: http.url } });
  const result = await service.crossrefLookup({ doi: '10.5555/synthetic',networkConsent: true });
  expect(providerResultSchema.safeParse(result).success).toBe(true);expect(result.provider).toBe('crossref');
  expect(result.records[0].metadata.title).toBe('[REDACTED]');
});
it('preserves comparison states and error codes that coincide with a configured key', async () => {
  const http = await fakeServer((req,res) => req.url!.includes('/items/') ? json(res,{},403) : json(res,{ message: crossrefWork() }));closers.push(http.close);
  const comparisonService = createIntegrations({ ARA_ZOTERO_API_KEY: 'inconclusive' },{ testBases: { crossref: http.url } });
  const compared = await comparisonService.crossrefLookup({ doi: '10.5555/synthetic',expected: { author: 'Example' },networkConsent: true });
  expect(providerResultSchema.safeParse(compared).success).toBe(true);
  expect(compared.records[0].comparison.find(c => c.field === 'author')?.state).toBe('inconclusive');
  const errorService = createIntegrations({ ARA_ZOTERO_API_KEY: 'AUTHENTICATION_REQUIRED' },{ testBases: { zotero: http.url } });
  const failed = await errorService.zoteroGet({ libraryType: 'users',libraryId: '123',itemKey: 'ABCD1234',access: 'private',networkConsent: true });
  expect(failed.error?.code).toBe('AUTHENTICATION_REQUIRED');
});
it('redacts a literal contact containing percent characters as well as its encoded echo', async () => {
  const contact = 'contact%41@example.invalid';
  const http = await fakeServer((_req,res) => json(res,{ message: crossrefWork({ title: [contact],URL: `https://example.invalid/?contact=${encodeURIComponent(contact)}` }) }));closers.push(http.close);
  const service = createIntegrations({ ARA_CROSSREF_CONTACT: contact },{ testBases: { crossref: http.url } });
  const result = await service.crossrefLookup({ doi: '10.5555/synthetic',networkConsent: true });
  expect(JSON.stringify(result)).not.toContain(contact);
  expect(result.records[0].metadata.title).toBe('[REDACTED]');
});
it('ignores non-finite advertised rate windows instead of producing invalid permanent cooldowns', async () => {
  const http = await fakeServer((_req,res) => {
    res.setHeader('x-rate-limit-limit','1');res.setHeader('x-rate-limit-interval','9'.repeat(400)+'s');
    json(res,{ message: crossrefWork() });
  });closers.push(http.close);
  const service = createIntegrations({}, { minimumIntervalMs: 0,testBases: { crossref: http.url } });
  await service.crossrefLookup({ doi: '10.5555/synthetic',networkConsent: true });
  const result = await service.crossrefLookup({ doi: '10.5555/other',networkConsent: true });
  expect(providerResultSchema.safeParse(result).success).toBe(true);
  expect(result.error?.code).not.toBe('CLIENT_COOLDOWN');expect(http.requests).toHaveLength(2);
});
