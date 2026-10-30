import { describe, expect, it, vi } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import type { FetchLike } from '../src/languagetool-client.js';
import {
  englishCheckResponse,
  englishText,
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

async function captureError(promise: Promise<unknown>): Promise<LanguageToolError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

describe('LanguageToolClient.check', () => {
  it('sends a form-encoded POST to /v2/check with text and language', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(englishCheckResponse) });
    const client = createClient(fetchMock);

    const result = await client.check({ text: englishText, language: 'en-US' });

    expect(result.matches).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${TEST_BASE_URL}/v2/check`);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/x-www-form-urlencoded');
    const body = init.body as URLSearchParams;
    expect(body.get('text')).toBe(englishText);
    expect(body.get('language')).toBe('en-US');
    expect(body.has('level')).toBe(false);
    expect(body.has('disabledRules')).toBe(false);
  });

  it('forwards optional level and disabled rules/categories', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(englishCheckResponse) });
    await createClient(fetchMock).check({
      text: englishText,
      language: 'en-US',
      level: 'picky',
      disabledRules: ['WHITESPACE_RULE', 'EN_QUOTES'],
      disabledCategories: ['TYPOGRAPHY'],
    });

    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('level')).toBe('picky');
    expect(body.get('disabledRules')).toBe('WHITESPACE_RULE,EN_QUOTES');
    expect(body.get('disabledCategories')).toBe('TYPOGRAPHY');
  });

  it('reports a TIMEOUT when LanguageTool does not answer in time', async () => {
    const error = await captureError(createClient(hangingFetch, 20).check({ text: 'Hello', language: 'en' }));
    expect(error.code).toBe('TIMEOUT');
    expect(error.endpoint).toBe('/v2/check');
    expect(error.message).toContain('20 ms');
  });

  it('reports UNREACHABLE with the system error code when the connection is refused', async () => {
    const fetchMock = vi.fn<FetchLike>().mockRejectedValue(connectionRefused());
    const error = await captureError(createClient(fetchMock).check({ text: 'Hello', language: 'en' }));
    expect(error.code).toBe('UNREACHABLE');
    expect(error.message).toBe(`LanguageTool is unreachable at ${TEST_BASE_URL} (ECONNREFUSED)`);
    expect(error.httpStatus).toBeNull();
  });

  it('reports HTTP_ERROR with status and a controlled message for non-2xx answers', async () => {
    const fetchMock = routeFetch({
      'POST /v2/check': () => textResponse("Error: 'xx-YY' is not a language code known to LanguageTool.", 400),
    });
    const error = await captureError(createClient(fetchMock).check({ text: 'Hello', language: 'xx-YY' }));
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.message).toBe('LanguageTool answered HTTP 400 (request rejected, e.g. unknown language code or rule id)');
  });

  it('asks fetch not to follow redirects', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(englishCheckResponse) });
    await createClient(fetchMock).check({ text: englishText, language: 'en-US' });
    expect(fetchMock.mock.calls[0]![1].redirect).toBe('manual');
  });

  it('reports INVALID_RESPONSE for a non-JSON body', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => textResponse('<html>proxy error</html>') });
    const error = await captureError(createClient(fetchMock).check({ text: 'Hello', language: 'en' }));
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('not valid JSON');
  });

  it('reports INVALID_RESPONSE for incomplete JSON', async () => {
    const { matches: _matches, ...withoutMatches } = englishCheckResponse;
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(withoutMatches) });
    const error = await captureError(createClient(fetchMock).check({ text: 'Hello', language: 'en' }));
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('matches');
  });

  it('reports INVALID_RESPONSE when a match lacks its rule id', async () => {
    const broken = structuredClone(englishCheckResponse) as { matches: Array<{ rule: Record<string, unknown> }> };
    delete broken.matches[0]!.rule.id;
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(broken) });
    const error = await captureError(createClient(fetchMock).check({ text: 'Hello', language: 'en' }));
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('matches.0.rule.id');
  });

  it('never includes the analysed text in error messages', async () => {
    const secret = 'UNPUBLISHED-FINDING-42';
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse({ unexpected: true }) });
    const error = await captureError(createClient(fetchMock).check({ text: secret, language: 'en' }));
    expect(JSON.stringify(error.toDetails())).not.toContain(secret);
  });
});

describe('LanguageToolClient metadata endpoints', () => {
  it('retrieves the languages advertised by the server', async () => {
    const fetchMock = routeFetch({ 'GET /v2/languages': () => jsonResponse(languagesResponse) });
    const languages = await createClient(fetchMock).getLanguages();
    expect(languages).toEqual(languagesResponse);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${TEST_BASE_URL}/v2/languages`);
  });

  it('rejects a languages payload that is not an array', async () => {
    const fetchMock = routeFetch({ 'GET /v2/languages': () => jsonResponse({ languages: [] }) });
    const error = await captureError(createClient(fetchMock).getLanguages());
    expect(error.code).toBe('INVALID_RESPONSE');
  });

  it('retrieves server info', async () => {
    const fetchMock = routeFetch({ 'GET /v2/info': () => jsonResponse(infoResponse) });
    const info = await createClient(fetchMock).getInfo();
    expect(info.software.version).toBe('6.9-SNAPSHOT');
  });

  it('resolves the healthcheck on 2xx and rejects otherwise', async () => {
    await expect(
      createClient(routeFetch({ 'GET /v2/healthcheck': () => textResponse('OK') })).healthcheck(),
    ).resolves.toBeUndefined();

    const error = await captureError(createClient(routeFetch({})).healthcheck());
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.httpStatus).toBe(404);
  });
});
