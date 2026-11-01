/*
 * Opt-in smoke tests against the real providers, skipped unless ARA_LIVE_INTEGRATIONS=1
 * (npm run test:live). They send one public DOI, the example of the OpenAlex documentation, and
 * nothing else; never part of npm test or CI. The private Zotero test also needs an operator key
 * and item; it asserts on statuses only so that a failure never prints private library content.
 */
import { describe, expect, it } from 'vitest';

import { createIntegrations } from '../src/service.js';

const PUBLIC_DOI = '10.7717/peerj.4375';

describe.skipIf(process.env.ARA_LIVE_INTEGRATIONS !== '1')('opt-in live provider smoke tests', () => {
  const service = createIntegrations();

  it('retrieves public Crossref metadata with provenance', async () => {
    const result = await service.crossrefLookup({ doi: PUBLIC_DOI, networkConsent: true });
    expect(result.status).toBe('exact_match');
    expect(result.provenance.retrievedAt).toBeDefined();
  }, 30_000);

  it('retrieves public OpenAlex metadata with distinct identifiers', async () => {
    const result = await service.openalexLookup({ id: PUBLIC_DOI, networkConsent: true });
    expect(result.status).toBe('exact_match');
    expect(result.records[0]?.metadata.providerRecordId).toMatch(/^https:\/\/openalex\.org\/W\d+$/u);
  }, 30_000);

  it.skipIf(!process.env.ARA_LIVE_ZOTERO_LIBRARY_ID || !process.env.ARA_LIVE_ZOTERO_ITEM_KEY || !process.env.ARA_ZOTERO_API_KEY)(
    'reads a configured private Zotero item without displaying it',
    async () => {
      const result = await service.zoteroGet({
        libraryType: 'users',
        libraryId: process.env.ARA_LIVE_ZOTERO_LIBRARY_ID,
        itemKey: process.env.ARA_LIVE_ZOTERO_ITEM_KEY,
        access: 'private',
        networkConsent: true,
      });
      expect(result.status === 'exact_match').toBe(true);
    },
    30_000,
  );
});
