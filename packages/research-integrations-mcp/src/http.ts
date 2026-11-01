/*
 * The one HTTP client shared by every provider: GET only, bounded, sanitized.
 *
 * - Timeout over the whole call, including the body stream.
 * - The response body is read up to a byte limit, then the stream is cancelled.
 * - Redirects: none by default; a provider may allow a small number of same-origin redirects.
 *   A cross-origin or downgraded redirect is never followed, so headers carrying a credential
 *   never reach another origin.
 * - No automatic retry. Requests to one origin run one at a time, through a short bounded queue.
 *   Pacing (a minimum interval, or Crossref's advertised rate) may delay a call briefly. A cooldown
 *   requested by the provider (Backoff, Retry-After, 429, 503) is never slept through: calls during
 *   it are refused with CLIENT_COOLDOWN and the remaining delay.
 * - Upstream bodies of failed responses are discarded unread.
 * - Optional in-memory cache, for public metadata only.
 */
import { IntegrationError, LIMITS } from './contracts.js';
import type { Config } from './config.js';

export interface JsonResponse {
  data: unknown;
  retrievedAt: string;
  cacheHit: boolean;
  redirected: boolean;
  /** Total-Results header, when present and well-formed (Zotero). */
  totalResults?: number;
}

export interface GetRequest {
  url: URL;
  headers: Record<string, string>;
  /** Only public metadata may be cached; private library data never is. */
  cache: boolean;
  /** Same-origin redirects allowed; 0 rejects every redirect. */
  maxRedirects: number;
}

/** Test seams only: never set from the environment or a tool. */
export interface HttpOptions {
  minimumIntervalMs?: number;
  /** Longest wait for pacing before CLIENT_COOLDOWN is returned instead. */
  maxPacingWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Calls waiting for one origin, including the running one; more are refused with BUSY. */
const MAX_QUEUED_PER_ORIGIN = 4;
/** Cooldown after a 429 or 503 that gives no delay. */
const DEFAULT_THROTTLE_COOLDOWN_MS = 1000;

interface OriginState {
  queued: number;
  tail: Promise<void>;
  /** Earliest time of the next request for pacing; a short wait is allowed. */
  nextAt: number;
  /** End of a provider-requested cooldown; calls before it are refused. */
  cooldownUntil: number;
}

export class JsonClient {
  private readonly origins = new Map<string, OriginState>();
  private readonly cache = new Map<string, { expires: number; response: JsonResponse }>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly interval: number;
  private readonly maxPacingWait: number;

  constructor(
    private readonly config: Config,
    options: HttpOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.interval = options.minimumIntervalMs ?? 250;
    this.maxPacingWait = options.maxPacingWaitMs ?? 2000;
  }

  async get(request: GetRequest): Promise<JsonResponse> {
    const key = request.url.href;
    const cached = request.cache ? this.cached(key) : undefined;
    if (cached) {
      return cached;
    }

    const state = this.originState(request.url.origin);
    if (state.queued >= MAX_QUEUED_PER_ORIGIN) {
      throw new IntegrationError('BUSY');
    }
    state.queued += 1;
    const previous = state.tail;
    let release!: () => void;
    state.tail = new Promise<void>((resolve) => (release = resolve));
    try {
      await previous;
      // A queued identical request may have just been answered.
      const answered = request.cache ? this.cached(key) : undefined;
      if (answered) {
        return answered;
      }
      const cooldown = state.cooldownUntil - this.now();
      if (cooldown > 0) {
        throw new IntegrationError('CLIENT_COOLDOWN', undefined, Math.ceil(cooldown));
      }
      const wait = state.nextAt - this.now();
      if (wait > this.maxPacingWait) {
        throw new IntegrationError('CLIENT_COOLDOWN', undefined, Math.ceil(wait));
      }
      if (wait > 0) {
        await this.sleep(wait);
      }
      const response = await this.fetchJson(request, state);
      if (request.cache && this.config.cacheTtlMs > 0) {
        if (this.cache.size >= LIMITS.cacheEntries) {
          this.cache.delete(this.cache.keys().next().value!);
        }
        this.cache.set(key, { expires: this.now() + this.config.cacheTtlMs, response: structuredClone(response) });
      }
      return response;
    } finally {
      state.queued -= 1;
      release();
    }
  }

  /** The original retrievedAt is kept: a cache hit is not a new observation. */
  private cached(key: string): JsonResponse | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expires > this.now()) {
      return { ...structuredClone(entry.response), cacheHit: true };
    }
    this.cache.delete(key);
    return undefined;
  }

  private originState(origin: string): OriginState {
    let state = this.origins.get(origin);
    if (!state) {
      state = { queued: 0, tail: Promise.resolve(), nextAt: 0, cooldownUntil: 0 };
      this.origins.set(origin, state);
    }
    return state;
  }

  private async fetchJson(request: GetRequest, state: OriginState): Promise<JsonResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let url = request.url;
    let redirects = 0;
    let response: Response | undefined;
    try {
      for (;;) {
        state.nextAt = this.now() + this.interval;
        response = await fetch(url, {
          method: 'GET',
          headers: request.headers,
          redirect: 'manual',
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        const receivedAt = new Date(this.now()).toISOString();
        this.applyRateHeaders(response, state);

        if (response.status >= 300 && response.status < 400) {
          const target = sameOriginTarget(response.headers.get('location'), url);
          await discard(response);
          if (!target || redirects >= request.maxRedirects) {
            throw new IntegrationError('REDIRECT_BLOCKED', response.status, undefined, receivedAt);
          }
          redirects += 1;
          url = target;
          continue;
        }
        if (response.status === 404) {
          throw new IntegrationError('NOT_FOUND', 404, undefined, receivedAt);
        }
        if (response.status === 401 || response.status === 403) {
          throw new IntegrationError('AUTHENTICATION_REQUIRED', response.status, undefined, receivedAt);
        }
        if (response.status === 429) {
          throw new IntegrationError('RATE_LIMITED', 429, this.cooldown(state), receivedAt);
        }
        if (!response.ok) {
          const retryAfter = response.status === 503 ? this.cooldown(state) : undefined;
          throw new IntegrationError('HTTP_ERROR', response.status, retryAfter, receivedAt);
        }
        const data = await this.readJson(response);
        const total = response.headers.get('total-results');
        return {
          data,
          retrievedAt: receivedAt,
          cacheHit: false,
          redirected: redirects > 0,
          ...(total && /^\d{1,15}$/u.test(total) ? { totalResults: Number(total) } : {}),
        };
      }
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError(controller.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      if (response) {
        await discard(response);
      }
    }
  }

  /** Remaining cooldown, at least DEFAULT_THROTTLE_COOLDOWN_MS after a throttle without delay. */
  private cooldown(state: OriginState): number {
    state.cooldownUntil = Math.max(state.cooldownUntil, this.now() + DEFAULT_THROTTLE_COOLDOWN_MS);
    return Math.ceil(state.cooldownUntil - this.now());
  }

  /**
   * Zotero's Backoff may come with any response; Retry-After with 429/503. Crossref advertises
   * x-rate-limit-limit requests per x-rate-limit-interval. The longest delay wins.
   */
  private applyRateHeaders(response: Response, state: OriginState): void {
    const delay = Math.max(
      delayMs(response.headers.get('backoff'), this.now()),
      delayMs(response.headers.get('retry-after'), this.now()),
    );
    if (delay > 0) {
      state.cooldownUntil = Math.max(state.cooldownUntil, this.now() + delay);
    }
    const limit = Number(response.headers.get('x-rate-limit-limit'));
    const interval = /^(\d+(?:\.\d+)?)s$/u.exec(response.headers.get('x-rate-limit-interval') ?? '');
    const seconds = interval ? Number(interval[1]) : NaN;
    // Absurd or non-finite windows are ignored rather than turned into a permanent cooldown.
    if (Number.isFinite(limit) && limit > 0 && Number.isFinite(seconds) && seconds <= 60) {
      state.nextAt = Math.max(state.nextAt, this.now() + Math.ceil((seconds * 1000) / limit));
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    const length = response.headers.get('content-length');
    if (length && /^\d+$/u.test(length) && Number(length) > this.config.responseBytes) {
      throw new IntegrationError('RESPONSE_TOO_LARGE');
    }
    if (!response.body) {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        size += value.byteLength;
        if (size > this.config.responseBytes) {
          await reader.cancel().catch(() => {});
          throw new IntegrationError('RESPONSE_TOO_LARGE');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      throw new IntegrationError('INVALID_RESPONSE');
    }
  }
}

/** Seconds (integer or decimal) or an HTTP date, as milliseconds from now; 0 if absent or invalid. */
function delayMs(raw: string | null, now: number): number {
  if (!raw) {
    return 0;
  }
  if (/^\d+(?:\.\d+)?$/u.test(raw)) {
    return Math.min(Number(raw) * 1000, 24 * 60 * 60 * 1000);
  }
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - now), 24 * 60 * 60 * 1000) : 0;
}

/** The redirect target if it keeps the same scheme, host and port; undefined otherwise. */
function sameOriginTarget(location: string | null, current: URL): URL | undefined {
  if (!location) {
    return undefined;
  }
  try {
    const target = new URL(location, current);
    return target.origin === current.origin && !target.username && !target.password ? target : undefined;
  } catch {
    return undefined;
  }
}

async function discard(response: Response): Promise<void> {
  if (response.body && !response.body.locked) {
    await response.body.cancel().catch(() => {});
  }
}
