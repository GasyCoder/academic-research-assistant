import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { type FetchLike, LanguageToolClient } from '../src/languagetool-client.js';
import { checkTextInputSchema, runCheckText } from '../src/tools/check-text.js';
import { runGetSupportedLanguages } from '../src/tools/get-supported-languages.js';
import { runHealthCheck } from '../src/tools/health-check.js';
import { toolFailure, toolSuccess } from '../src/tools/results.js';
import {
  emptyCheckResponse,
  frenchCheckResponse,
  frenchText,
  infoResponse,
  languagesResponse,
} from './fixtures/languagetool-responses.js';
import {
  TEST_BASE_URL,
  connectionRefused,
  createClient,
  hangingFetch,
  jsonResponse,
  routeFetch,
  textResponse,
} from './helpers.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';

describe('health_check', () => {
  it('reports ok with version information', async () => {
    const client = createClient(
      routeFetch({
        'GET /v2/healthcheck': () => textResponse('OK'),
        'GET /v2/info': () => jsonResponse(infoResponse),
      }),
    );

    expect(await runHealthCheck(client)).toEqual({
      status: 'ok',
      reachable: true,
      baseUrl: TEST_BASE_URL,
      software: { name: 'LanguageTool', version: '6.9-SNAPSHOT', buildDate: '2026-10-29 18:47:38 +0100', apiVersion: null },
      error: null,
    });
  });

  it('stays ok when the version endpoint is missing', async () => {
    const client = createClient(routeFetch({ 'GET /v2/healthcheck': () => textResponse('OK') }));
    const result = await runHealthCheck(client);
    expect(result.status).toBe('ok');
    expect(result.software).toBeNull();
  });

  it('returns a structured error when LanguageTool is offline', async () => {
    const client = createClient(vi.fn<FetchLike>().mockRejectedValue(connectionRefused()));
    const result = await runHealthCheck(client);

    expect(result).toMatchObject({ status: 'unavailable', reachable: false, baseUrl: TEST_BASE_URL, software: null });
    expect(result.error).toEqual({
      code: 'UNREACHABLE',
      message: `LanguageTool is unreachable at ${TEST_BASE_URL} (ECONNREFUSED)`,
      endpoint: '/v2/healthcheck',
      httpStatus: null,
    });
  });

  it('reports a timeout as unavailable', async () => {
    const result = await runHealthCheck(createClient(hangingFetch, 20));
    expect(result.status).toBe('unavailable');
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('reports an HTTP error as unhealthy but reachable', async () => {
    const client = createClient(routeFetch({ 'GET /v2/healthcheck': () => textResponse('down', 503) }));
    const result = await runHealthCheck(client);
    expect(result).toMatchObject({ status: 'unhealthy', reachable: true });
    expect(result.error?.httpStatus).toBe(503);
  });
});

describe('health_check against a real HTTP server', () => {
  let httpServer: TestHttpServer | undefined;
  afterEach(async () => {
    await httpServer?.close();
    httpServer = undefined;
  });
  const clientFor = (server: TestHttpServer) => new LanguageToolClient({ baseUrl: server.url, timeoutMs: 200 });

  it('is unavailable when the server accepts the connection but never answers', async () => {
    httpServer = await startHttpServer(() => {
      // Never responds.
    });
    const result = await runHealthCheck(clientFor(httpServer));

    expect(result).toMatchObject({ status: 'unavailable', reachable: false });
    expect(result.error).toMatchObject({ code: 'TIMEOUT', httpStatus: null });
  });

  it('is reachable but unhealthy when headers arrive and the body times out', async () => {
    httpServer = await startHttpServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('O');
      // The rest of the body never comes.
    });
    const result = await runHealthCheck(clientFor(httpServer));

    expect(result).toMatchObject({ status: 'unhealthy', reachable: true });
    expect(result.error).toMatchObject({ code: 'TIMEOUT', httpStatus: 200, endpoint: '/v2/healthcheck' });
    expect(result.error?.message).toContain('HTTP 200');
  });

  it('is reachable but unhealthy when the body is cut off', async () => {
    httpServer = await startHttpServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '100' });
      response.write('OK');
      // Let the headers reach the client before cutting the connection.
      setTimeout(() => response.destroy(), 50);
    });
    const result = await runHealthCheck(clientFor(httpServer));

    expect(result).toMatchObject({ status: 'unhealthy', reachable: true });
    expect(result.error).toMatchObject({ code: 'INVALID_RESPONSE', httpStatus: 200 });
  });
});

describe('get_supported_languages', () => {
  it('returns the languages reported by the server', async () => {
    const client = createClient(routeFetch({ 'GET /v2/languages': () => jsonResponse(languagesResponse) }));
    const result = await runGetSupportedLanguages(client);
    expect(result.count).toBe(languagesResponse.length);
    expect(result.languages.map((language) => language.longCode)).toEqual(['en', 'en-US', 'en-GB', 'fr', 'fr-CA', 'ar']);
  });

  it('propagates LanguageTool errors', async () => {
    const client = createClient(vi.fn<FetchLike>().mockRejectedValue(connectionRefused()));
    await expect(runGetSupportedLanguages(client)).rejects.toMatchObject({ code: 'UNREACHABLE' });
  });
});

describe('check_text input validation', () => {
  it.each(['', '   ', '\n\t'])('rejects empty text %j', (text) => {
    const result = checkTextInputSchema.safeParse({ text, language: 'en-US' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('text must not be empty');
  });

  it('requires a language', () => {
    expect(checkTextInputSchema.safeParse({ text: 'Hello' }).success).toBe(false);
  });

  it.each(['en', 'en-US', 'fr', 'ca-ES-valencia', 'de-DE-x-simple-language', 'auto', ' fr '])(
    'accepts language code %j',
    (language) => {
      expect(checkTextInputSchema.safeParse({ text: 'Hello', language }).success).toBe(true);
    },
  );

  it.each(['', 'english', 'en_US', 'en-US;drop', 'fr,en'])('rejects language code %j', (language) => {
    expect(checkTextInputSchema.safeParse({ text: 'Hello', language }).success).toBe(false);
  });

  it('rejects rule ids containing separators', () => {
    const result = checkTextInputSchema.safeParse({ text: 'Hello', language: 'en', disabledRules: ['A,B'] });
    expect(result.success).toBe(false);
  });

  it('accepts the optional options', () => {
    const result = checkTextInputSchema.safeParse({
      text: 'Hello',
      language: 'en-US',
      level: 'picky',
      disabledRules: ['WHITESPACE_RULE'],
      disabledCategories: ['TYPOGRAPHY'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown levels', () => {
    expect(checkTextInputSchema.safeParse({ text: 'Hello', language: 'en', level: 'strict' }).success).toBe(false);
  });
});

describe('check_text', () => {
  it('returns structured issues without altering the text sent', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(frenchCheckResponse) });
    const input = checkTextInputSchema.parse({ text: frenchText, language: 'fr' });
    const result = await runCheckText(createClient(fetchMock), input);

    expect((fetchMock.mock.calls[0]![1].body as URLSearchParams).get('text')).toBe(frenchText);
    expect(result.requestedLanguage).toBe('fr');
    expect(result.issueCount).toBe(2);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(['A_A_ACCENT', 'ACCORD_R_PERS_VERBE']);
    expect(result).not.toHaveProperty('correctedText');
  });

  it('preserves leading and trailing whitespace of the text', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(emptyCheckResponse) });
    const input = checkTextInputSchema.parse({ text: '  Hello world.\n', language: 'en-US' });
    await runCheckText(createClient(fetchMock), input);
    expect((fetchMock.mock.calls[0]![1].body as URLSearchParams).get('text')).toBe('  Hello world.\n');
  });

  it('returns zero issues for a clean text', async () => {
    const client = createClient(routeFetch({ 'POST /v2/check': () => jsonResponse(emptyCheckResponse) }));
    const result = await runCheckText(client, { text: 'This sentence is correct.', language: 'en-US' });
    expect(result.issueCount).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it('propagates a timeout', async () => {
    await expect(runCheckText(createClient(hangingFetch, 20), { text: 'Hello', language: 'en' })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});

describe('tool results', () => {
  it('exposes successful data as structured content and JSON text', () => {
    const result = toolSuccess({ a: 1 });
    expect(result.structuredContent).toEqual({ a: 1 });
    expect(result.content).toEqual([{ type: 'text', text: '{"a":1}' }]);
    expect(result.isError).toBeUndefined();
  });

  it('turns LanguageTool errors into actionable error results', () => {
    const result = toolFailure(
      new LanguageToolError('HTTP_ERROR', 'LanguageTool answered HTTP 400', { endpoint: '/v2/check', httpStatus: 400 }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      error: { code: 'HTTP_ERROR', message: 'LanguageTool answered HTTP 400', endpoint: '/v2/check', httpStatus: 400 },
    });
  });

  it('maps unexpected errors to INTERNAL_ERROR', () => {
    const result = toolFailure(new Error('boom'));
    expect(JSON.parse((result.content[0] as { text: string }).text).error.code).toBe('INTERNAL_ERROR');
  });
});
