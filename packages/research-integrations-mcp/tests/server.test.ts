import { createRequire } from 'node:module';

import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, expect, it } from 'vitest';

import { LIMITS, providerResultSchema } from '../src/contracts.js';
import { createServer, SERVER_VERSION, toolResult } from '../src/server.js';
import { createIntegrations } from '../src/service.js';
import { closeAll, crossrefWork, fakeServer, json, track, zoteroItem, type Handler } from './helpers.js';

afterEach(closeAll);

async function session(handler: Handler, env: NodeJS.ProcessEnv = {}) {
  const http = await fakeServer(handler);
  track(http.close);
  const service = createIntegrations(env, { minimumIntervalMs: 0, testBases: { crossref: http.url, zotero: http.url } });
  const server = createServer(service);
  const client = new Client({ name: 'synthetic-test', version: '0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  track(() => client.close());
  return { client, http };
}

it('reports the repository version, from its own manifest (docs/releasing.md)', () => {
  const require = createRequire(import.meta.url);
  expect(SERVER_VERSION).toBe((require('../package.json') as { version: string }).version);
  expect(SERVER_VERSION).toBe((require('../../../package.json') as { version: string }).version);
});

it('returns schema-valid metadata and the same JSON as text through the official client', async () => {
  const { client } = await session((_req, res) => json(res, { message: crossrefWork() }));
  const result = await client.callTool({ name: 'crossref_lookup_doi', arguments: { doi: '10.5555/synthetic', networkConsent: true } });
  expect(result.isError).toBeFalsy();
  expect(providerResultSchema.safeParse(result.structuredContent).success).toBe(true);
  expect(result.structuredContent).toMatchObject({ status: 'exact_match', records: [{ metadata: { title: 'Synthetic Methods' } }] });
  expect(JSON.parse((result.content as { text: string }[])[0]!.text)).toEqual(result.structuredContent);
});

it('keeps secret echoes out of both MCP result representations', async () => {
  const key = 'synthetic-zotero-secret';
  const { client } = await session((_req, res) => json(res, zoteroItem({ title: key })), { ARA_ZOTERO_API_KEY: key });
  const result = await client.callTool({
    name: 'zotero_get_item',
    arguments: { libraryType: 'users', libraryId: '123', itemKey: 'ABCD1234', access: 'private', networkConsent: true },
  });
  expect(result.structuredContent).toMatchObject({ status: 'exact_match' });
  expect(JSON.stringify(result)).not.toContain(key);
});

it('bounds the whole serialized envelope, including the text copy and escaping', () => {
  const result = toolResult({ metadata: '\\"漢'.repeat(LIMITS.resultBytes / 2) });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).toContain('RESPONSE_TOO_LARGE');
  expect(JSON.stringify(result).length).toBeLessThan(1000);
});
