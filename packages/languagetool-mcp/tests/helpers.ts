import { vi } from 'vitest';

import type { FetchLike } from '../src/languagetool-client.js';
import { LanguageToolClient } from '../src/languagetool-client.js';

export const TEST_BASE_URL = 'http://lt.test:8081';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

/** Simulates undici's error when the TCP connection is refused. */
export function connectionRefused(): TypeError {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8081'), { code: 'ECONNREFUSED' });
  return new TypeError('fetch failed', { cause });
}

/** A fetch that never answers, but rejects like the real one when its signal aborts. */
export const hangingFetch: FetchLike = (_input, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

/** Routes requests by "METHOD /path" to canned responses. */
export function routeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  return vi.fn<FetchLike>(async (input, init) => {
    const key = `${init.method ?? 'GET'} ${new URL(input).pathname}`;
    const handler = routes[key];
    if (!handler) {
      return textResponse(`no route for ${key}`, 404);
    }
    return handler();
  });
}

export function createClient(fetchImpl: FetchLike, timeoutMs = 1000): LanguageToolClient {
  return new LanguageToolClient({ baseUrl: TEST_BASE_URL, timeoutMs, fetch: fetchImpl });
}
