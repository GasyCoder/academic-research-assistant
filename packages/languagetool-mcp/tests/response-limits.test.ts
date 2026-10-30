import { afterEach, describe, expect, it } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { DEFAULT_MAX_RESPONSE_BYTES, LanguageToolClient } from '../src/languagetool-client.js';
import { emptyCheckResponse } from './fixtures/languagetool-responses.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';
import { TEST_BASE_URL, jsonResponse } from './helpers.js';

const LIMIT = 64 * 1024;
const CHUNK = new Uint8Array(16 * 1024).fill(0x20);

/** A body of `chunks` chunks that records how many were actually pulled by the reader. */
function countingBody(chunks: number) {
  const stats = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (stats.pulled >= chunks) {
        controller.close();
        return;
      }
      stats.pulled++;
      controller.enqueue(CHUNK);
    },
  });
  return { stream, stats };
}

function clientReturning(response: Response): LanguageToolClient {
  return new LanguageToolClient({
    baseUrl: TEST_BASE_URL,
    timeoutMs: 2000,
    maxResponseBytes: LIMIT,
    fetch: async () => response,
  });
}

async function captureError(promise: Promise<unknown>): Promise<LanguageToolError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

let httpServer: TestHttpServer | undefined;
afterEach(async () => {
  await httpServer?.close();
  httpServer = undefined;
});

describe('response size limit', () => {
  it('uses a documented default', () => {
    expect(DEFAULT_MAX_RESPONSE_BYTES).toBe(8 * 1024 * 1024);
  });

  it('stops reading a streamed body as soon as it exceeds the limit', async () => {
    const { stream, stats } = countingBody(10_000);
    const client = clientReturning(new Response(stream, { status: 200 }));

    const error = await captureError(client.getLanguages());

    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toBe(`LanguageTool response exceeds the ${LIMIT}-byte limit`);
    expect(error.httpStatus).toBe(200);
    expect(stats.pulled).toBeLessThanOrEqual(LIMIT / CHUNK.byteLength + 2);
  });

  it('rejects a declared Content-Length above the limit without reading the body', async () => {
    const { stream, stats } = countingBody(10_000);
    const response = new Response(stream, { status: 200, headers: { 'Content-Length': String(LIMIT * 100) } });

    const error = await captureError(clientReturning(response).check({ text: 'Hello', language: 'en' }));

    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('limit');
    expect(stats.pulled).toBeLessThanOrEqual(1);
  });

  it('does not read oversized error bodies', async () => {
    const { stream, stats } = countingBody(10_000);
    const error = await captureError(clientReturning(new Response(stream, { status: 500 })).getLanguages());

    expect(error.code).toBe('HTTP_ERROR');
    expect(stats.pulled).toBeLessThanOrEqual(1);
  });

  it('accepts a body within the limit', async () => {
    const result = await clientReturning(jsonResponse(emptyCheckResponse)).check({ text: 'Hello', language: 'en' });
    expect(result.matches).toEqual([]);
  });

  it('accepts a body of exactly the limit', async () => {
    const padded = JSON.stringify(emptyCheckResponse).padEnd(LIMIT, ' ');
    const result = await clientReturning(new Response(padded)).check({ text: 'Hello', language: 'en' });
    expect(result.matches).toEqual([]);
  });

  it('aborts an oversized chunked answer from a real HTTP server', async () => {
    let written = 0;
    httpServer = await startHttpServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      const writeMore = () => {
        // Stops after 64 MiB at most; the client is expected to hang up long before.
        while (written < 64 * 1024 * 1024 && !response.destroyed) {
          written += CHUNK.byteLength;
          if (!response.write(CHUNK)) {
            response.once('drain', writeMore);
            return;
          }
        }
        response.end();
      };
      writeMore();
    });
    const client = new LanguageToolClient({ baseUrl: httpServer.url, timeoutMs: 5000, maxResponseBytes: LIMIT });

    const error = await captureError(client.getLanguages());

    expect(error.code).toBe('INVALID_RESPONSE');
    expect(written).toBeLessThan(16 * 1024 * 1024);
  });
});
