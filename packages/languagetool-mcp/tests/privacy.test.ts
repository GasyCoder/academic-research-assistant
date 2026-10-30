/*
 * Regression tests: the analysed text must never leave through HTTP redirects
 * nor come back to the MCP client through error messages.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { LanguageToolClient } from '../src/languagetool-client.js';
import { runCheckText } from '../src/tools/check-text.js';
import { toolFailure } from '../src/tools/results.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';

const MANUSCRIPT = 'Unpublished result: compound QX-17 reduced mortality by 42 percent.';
const ENCODED_MARKER = 'QX-17';

const servers: TestHttpServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function server(handler: Parameters<typeof startHttpServer>[0]): Promise<TestHttpServer> {
  const started = await startHttpServer(handler);
  servers.push(started);
  return started;
}

/** Uses the real global fetch, as in production. */
function clientFor(baseUrl: string): LanguageToolClient {
  return new LanguageToolClient({ baseUrl, timeoutMs: 2000 });
}

async function captureError(promise: Promise<unknown>): Promise<LanguageToolError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

describe('HTTP redirects', () => {
  it.each([301, 302, 303, 307, 308])('does not follow a %i redirect and never sends the text elsewhere', async (status) => {
    const external = await server((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ matches: [] }));
    });
    const languageTool = await server((_request, response) => {
      response.writeHead(status, { Location: `${external.url}/v2/check` });
      response.end();
    });

    const error = await captureError(clientFor(languageTool.url).check({ text: MANUSCRIPT, language: 'en' }));

    expect(languageTool.requests).toHaveLength(1);
    expect(external.requests).toHaveLength(0);
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.httpStatus).toBe(status);
    expect(error.message).toContain('redirect');
    expect(error.message).not.toContain(external.url);
  });

  it('does not follow redirects on metadata endpoints either', async () => {
    const external = await server((_request, response) => response.end('[]'));
    const languageTool = await server((_request, response) => {
      response.writeHead(302, { Location: `${external.url}/v2/languages` });
      response.end();
    });

    await captureError(clientFor(languageTool.url).getLanguages());
    expect(external.requests).toHaveLength(0);
  });
});

describe('HTTP error bodies', () => {
  it.each([400, 413, 500, 503])('does not copy an HTTP %i body echoing the text into the error', async (status) => {
    const languageTool = await server((request, response) => {
      response.writeHead(status, { 'Content-Type': 'text/plain' });
      response.end(`Error while checking: ${new URLSearchParams(request.body).get('text')}`);
    });

    const error = await captureError(clientFor(languageTool.url).check({ text: MANUSCRIPT, language: 'en' }));

    expect(error.code).toBe('HTTP_ERROR');
    expect(error.httpStatus).toBe(status);
    expect(error.endpoint).toBe('/v2/check');
    expect(error.message).not.toContain(ENCODED_MARKER);
    expect(JSON.stringify(toolFailure(error))).not.toContain(ENCODED_MARKER);
  });

  it('describes a 400 with a controlled hint', async () => {
    const languageTool = await server((_request, response) => {
      response.writeHead(400);
      response.end("Error: 'xx-YY' is not a language code known to LanguageTool.");
    });

    const error = await captureError(clientFor(languageTool.url).check({ text: MANUSCRIPT, language: 'xx-YY' }));
    expect(error.message).toBe('LanguageTool answered HTTP 400 (request rejected, e.g. unknown language code or rule id)');
  });

  it('keeps the text out of the check_text error result', async () => {
    const languageTool = await server((request, response) => {
      response.writeHead(500);
      response.end(request.body);
    });

    const failure = await runCheckText(clientFor(languageTool.url), { text: MANUSCRIPT, language: 'en' }).then(
      () => undefined,
      (error: unknown) => toolFailure(error),
    );
    expect(failure?.isError).toBe(true);
    expect(JSON.stringify(failure)).not.toContain(ENCODED_MARKER);
  });

  it('does not echo the body of an unparsable JSON answer', async () => {
    const languageTool = await server((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(`{"echo": "${new URLSearchParams(request.body).get('text')}"`);
    });

    const error = await captureError(clientFor(languageTool.url).check({ text: MANUSCRIPT, language: 'en' }));
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(JSON.stringify(toolFailure(error))).not.toContain(ENCODED_MARKER);
  });
});

describe('unexpected exceptions', () => {
  it('never exposes the message of a non-LanguageTool error', () => {
    const result = toolFailure(new Error(`failed on ${MANUSCRIPT}`));
    expect(JSON.stringify(result)).not.toContain(ENCODED_MARKER);
    expect(JSON.parse((result.content[0] as { text: string }).text).error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected internal error',
      endpoint: null,
      httpStatus: null,
    });
  });
});
