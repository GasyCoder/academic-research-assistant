/*
 * Slow starts, timeouts and outages against synthetic LanguageTool servers on
 * local ports, using the real global fetch as in production.
 */
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { LanguageToolClient } from '../src/languagetool-client.js';
import { runCheckText } from '../src/tools/check-text.js';
import { runHealthCheck } from '../src/tools/health-check.js';
import { toolFailure } from '../src/tools/results.js';
import { emptyCheckResponse, infoResponse } from './fixtures/languagetool-responses.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';

const MANUSCRIPT = 'Unpublished result: alloy ZR-88 doubled fatigue life under cyclic load.';
const MARKER = 'ZR-88';

const servers: TestHttpServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

/**
 * Behaves like a real LanguageTool: /v2/healthcheck answers at once, while the first
 * /v2/check in a language waits `loadMs` for the language to load. Loading goes on
 * even if the client gives up, so later checks in that language are immediate.
 */
async function coldStartLanguageTool(loadMs: number): Promise<TestHttpServer> {
  const loaded = new Map<string, Promise<unknown>>();
  const server = await startHttpServer((request, response) => {
    const json = (body: unknown) => {
      if (!response.destroyed) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(body));
      }
    };
    if (request.url === '/v2/healthcheck') {
      response.end('OK');
    } else if (request.url === '/v2/info') {
      json(infoResponse);
    } else if (request.method === 'POST' && request.url === '/v2/check') {
      const language = new URLSearchParams(request.body).get('language') ?? '';
      if (!loaded.has(language)) {
        loaded.set(language, delay(loadMs));
      }
      void loaded.get(language)!.then(() => json(emptyCheckResponse));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  servers.push(server);
  return server;
}

function checkRequests(server: TestHttpServer) {
  return server.requests.filter((request) => request.url === '/v2/check');
}

async function timed<T>(promise: Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await promise;
  return { value, ms: performance.now() - start };
}

async function captureError(promise: Promise<unknown>): Promise<LanguageToolError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

describe('LanguageTool outage', () => {
  it('reports a closed port as UNREACHABLE, and health_check as unavailable', async () => {
    const stopped = await startHttpServer(() => undefined);
    await stopped.close();
    const client = new LanguageToolClient({ baseUrl: stopped.url, timeoutMs: 2000 });

    const error = await captureError(runCheckText(client, { text: MANUSCRIPT, language: 'en' }));
    expect(error.toDetails()).toEqual({
      code: 'UNREACHABLE',
      message: `LanguageTool is unreachable at ${stopped.url} (ECONNREFUSED)`,
      endpoint: '/v2/check',
      httpStatus: null,
    });
    expect(await runHealthCheck(client)).toMatchObject({ status: 'unavailable', reachable: false });
  });
});

describe('slow LanguageTool answers', () => {
  it('returns a fast answer', async () => {
    const languageTool = await coldStartLanguageTool(0);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 2000 });

    const result = await runCheckText(client, { text: MANUSCRIPT, language: 'en-US' });
    expect(result.issueCount).toBe(0);
  });

  it('waits for a slow but valid answer that arrives within the timeout', async () => {
    const languageTool = await coldStartLanguageTool(300);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 2000 });

    const { value, ms } = await timed(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    expect(value.issueCount).toBe(0);
    expect(ms).toBeGreaterThanOrEqual(250);
  });

  it('reports TIMEOUT after sending the text once, without retrying or quoting it', async () => {
    const languageTool = await coldStartLanguageTool(1000);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 100 });

    const error = await captureError(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    // Leave time for a retry to show up, if there were one.
    await delay(200);

    expect(error.toDetails()).toEqual({
      code: 'TIMEOUT',
      message: `LanguageTool did not answer within 100 ms (${languageTool.url})`,
      endpoint: '/v2/check',
      httpStatus: null,
    });
    expect(checkRequests(languageTool)).toHaveLength(1);
    expect(JSON.stringify(toolFailure(error))).not.toContain(MARKER);
  });
});

describe('language cold start', () => {
  it('makes the first check in a language slow, and the following ones fast', async () => {
    const languageTool = await coldStartLanguageTool(400);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 2000 });

    const first = await timed(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    const second = await timed(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    const otherLanguage = await timed(runCheckText(client, { text: MANUSCRIPT, language: 'de-DE' }));

    expect(first.ms).toBeGreaterThanOrEqual(350);
    expect(second.ms).toBeLessThan(350);
    expect(otherLanguage.ms).toBeGreaterThanOrEqual(350);
  });

  it('succeeds on a later call once a timed-out language has finished loading', async () => {
    const languageTool = await coldStartLanguageTool(300);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 100 });

    const error = await captureError(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    expect(error.code).toBe('TIMEOUT');
    await delay(400);
    const result = await runCheckText(client, { text: MANUSCRIPT, language: 'fr' });

    expect(result.issueCount).toBe(0);
    // One request per explicit call: the client never resends the text by itself.
    expect(checkRequests(languageTool)).toHaveLength(2);
  });

  it('keeps health_check ok while a language is loading', async () => {
    const languageTool = await coldStartLanguageTool(500);
    const client = new LanguageToolClient({ baseUrl: languageTool.url, timeoutMs: 2000 });

    const check = timed(runCheckText(client, { text: MANUSCRIPT, language: 'fr' }));
    await delay(50);
    const health = await timed(runHealthCheck(client));

    expect(health.value).toMatchObject({ status: 'ok', reachable: true, error: null });
    expect(health.ms).toBeLessThan(400);
    expect((await check).value.issueCount).toBe(0);
  });
});
