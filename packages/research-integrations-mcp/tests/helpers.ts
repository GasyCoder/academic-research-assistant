/*
 * Local fake provider servers and synthetic records. Every identifier, name, key and contact here
 * is synthetic; 10.5555 is a test DOI prefix and no test reaches a real provider.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createIntegrations } from '../src/service.js';
import type { TestOptions } from '../src/providers.js';

export interface RecordedRequest {
  url: string;
  method: string;
  headers: IncomingMessage['headers'];
}

export type Handler = (req: IncomingMessage, res: ServerResponse) => void;

export async function fakeServer(handler: Handler = (_req, res) => res.end('{}')) {
  const requests: RecordedRequest[] = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url!, method: req.method!, headers: req.headers });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function json(res: ServerResponse, value: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

const closers: (() => Promise<void>)[] = [];
export async function closeAll(): Promise<void> {
  await Promise.all(closers.splice(0).map((close) => close()));
}

/**
 * Integrations pointed at one fake server for every provider. Pacing is disabled by default so
 * that tests are fast; transport tests enable it explicitly.
 */
export async function setup(handler?: Handler, env: NodeJS.ProcessEnv = {}, options: TestOptions = {}) {
  const server = await fakeServer(handler);
  closers.push(server.close);
  const service = createIntegrations(
    { ARA_INTEGRATIONS_TIMEOUT_MS: '2000', ...env },
    {
      minimumIntervalMs: 0,
      testBases: { crossref: `${server.url}v1/`, openalex: server.url, zotero: server.url, zoteroLocal: `${server.url}api/` },
      ...options,
    },
  );
  return { server, service };
}
export function track(close: () => Promise<void>): void {
  closers.push(close);
}

export const consent = { networkConsent: true } as const;
export const library = { libraryType: 'users', libraryId: '123', ...consent } as const;

export const crossrefWork = (overrides: Record<string, unknown> = {}) => ({
  DOI: '10.5555/synthetic',
  title: ['Synthetic Methods'],
  author: [{ given: 'Ada', family: 'Example', ORCID: 'https://orcid.org/0000-0000-0000-0000' }],
  'published-print': { 'date-parts': [[2021, 2, 1]] },
  'published-online': { 'date-parts': [[2020, 12, 1]] },
  'container-title': ['Synthetic Journal'],
  volume: '3',
  issue: '2',
  page: '1-7',
  type: 'journal-article',
  URL: 'https://doi.org/10.5555/synthetic',
  abstract: '<jats:p>SYNTHETIC_ABSTRACT</jats:p>',
  ...overrides,
});

export const openalexWork = (overrides: Record<string, unknown> = {}) => ({
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.5555/synthetic',
  title: 'Synthetic Methods',
  authorships: [{ author: { display_name: 'Ada Example', orcid: null } }],
  publication_year: 2020,
  publication_date: '2020-12-01',
  primary_location: { source: { display_name: 'Synthetic Journal' }, landing_page_url: 'https://doi.org/10.5555/synthetic' },
  ids: { openalex: 'https://openalex.org/W123', doi: 'https://doi.org/10.5555/synthetic', mag: '123' },
  biblio: { volume: '3', issue: '2', first_page: '1', last_page: '7' },
  type: 'article',
  is_retracted: false,
  ...overrides,
});

export const zoteroItem = (overrides: Record<string, unknown> = {}) => ({
  key: 'ABCD1234',
  data: {
    itemType: 'journalArticle',
    title: 'Synthetic Methods',
    creators: [{ firstName: 'Ada', lastName: 'Example', creatorType: 'author' }],
    DOI: '10.5555/synthetic',
    date: '2021-02-01',
    publicationTitle: 'Synthetic Journal',
    abstractNote: 'SYNTHETIC_PRIVATE_ABSTRACT',
    extra: 'SYNTHETIC_PRIVATE_EXTRA',
    ...overrides,
  },
});
