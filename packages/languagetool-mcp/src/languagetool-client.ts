import type { z } from 'zod';

import type { LanguageToolConfig } from './config.js';
import { LanguageToolError } from './errors.js';
import {
  type RawCheckResponse,
  type RawInfo,
  type RawLanguage,
  checkResponseSchemaFor,
  rawInfoSchema,
  rawLanguagesSchema,
} from './languagetool-schemas.js';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Largest LanguageTool response body accepted, in bytes. Large enough for the
 * diagnostics of a long chapter; bigger answers are rejected while streaming.
 */
export const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/**
 * Longest text sent in one check, in UTF-16 code units (JavaScript string length, like issue offsets).
 * About 7,500 words. Measured on a warm LanguageTool: ~4 s per check, and ~5 MB of response for a text
 * with a spelling error on every word, within DEFAULT_MAX_RESPONSE_BYTES. Longer texts are rejected,
 * never truncated.
 */
export const DEFAULT_MAX_TEXT_LENGTH = 50_000;

export interface LanguageToolClientOptions extends LanguageToolConfig {
  /** HTTP implementation; defaults to the global fetch. Injected in tests. */
  fetch?: FetchLike;
  /** Defaults to DEFAULT_MAX_RESPONSE_BYTES. */
  maxResponseBytes?: number;
  /** Defaults to DEFAULT_MAX_TEXT_LENGTH. */
  maxTextLength?: number;
}

export interface CheckRequest {
  text: string;
  /** LanguageTool language code (e.g. "en-US", "fr") or "auto". */
  language: string;
  level?: 'default' | 'picky';
  disabledRules?: readonly string[];
  disabledCategories?: readonly string[];
}

/**
 * Thin HTTP client for the LanguageTool v2 API.
 * Every failure is reported as a LanguageToolError whose message is built from
 * controlled technical data only: never the text, and never a body sent by the server.
 * Redirects are never followed, so the text cannot be forwarded to another origin.
 */
export class LanguageToolClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxTextLength: number;
  private readonly fetchImpl: FetchLike;
  private readonly maxResponseBytes: number;

  constructor(options: LanguageToolClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs;
    this.maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Resolves when GET /v2/healthcheck answers with a 2xx status. */
  async healthcheck(): Promise<void> {
    const endpoint = '/v2/healthcheck';
    const signal = AbortSignal.timeout(this.timeoutMs);
    const response = await this.request(endpoint, { method: 'GET' }, signal);
    await this.readBody(response, endpoint, signal);
  }

  /** Server metadata (name, version, build date). Sends no text. */
  async getInfo(): Promise<RawInfo> {
    return this.requestJson('/v2/info', { method: 'GET' }, rawInfoSchema);
  }

  async getLanguages(): Promise<RawLanguage[]> {
    return this.requestJson('/v2/languages', { method: 'GET' }, rawLanguagesSchema);
  }

  async check(request: CheckRequest): Promise<RawCheckResponse> {
    if (request.text.length > this.maxTextLength) {
      // The length is reported, never the content.
      throw new LanguageToolError(
        'TEXT_TOO_LONG',
        `Text has ${request.text.length} characters (UTF-16 code units), above the ${this.maxTextLength}-character ` +
          'limit per check; split it and check the parts separately',
        { endpoint: '/v2/check' },
      );
    }
    const body = new URLSearchParams({ text: request.text, language: request.language });
    if (request.level !== undefined) {
      body.set('level', request.level);
    }
    if (request.disabledRules !== undefined && request.disabledRules.length > 0) {
      body.set('disabledRules', request.disabledRules.join(','));
    }
    if (request.disabledCategories !== undefined && request.disabledCategories.length > 0) {
      body.set('disabledCategories', request.disabledCategories.join(','));
    }
    return this.requestJson(
      '/v2/check',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      checkResponseSchemaFor(request.text.length),
    );
  }

  private async requestJson<T>(endpoint: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    const response = await this.request(endpoint, init, signal);
    const body = await this.readBody(response, endpoint, signal);

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch (cause) {
      throw new LanguageToolError('INVALID_RESPONSE', 'LanguageTool returned a body that is not valid JSON', {
        endpoint,
        httpStatus: response.status,
        cause,
      });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      // Paths come from our schemas; issue codes and custom messages are ours or Zod's: no payload value is quoted.
      const problems = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code === 'custom' ? issue.message : issue.code}`)
        .join('; ');
      throw new LanguageToolError('INVALID_RESPONSE', `LanguageTool returned an unexpected JSON structure (${problems})`, {
        endpoint,
        httpStatus: response.status,
      });
    }
    return parsed.data;
  }

  private async request(endpoint: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
        ...init,
        headers,
        signal,
        // A followed 307/308 would resend the text to the Location origin.
        redirect: 'manual',
      });
    } catch (error) {
      throw this.toTransportError(error, endpoint);
    }

    if (!response.ok) {
      // Error bodies may echo the submitted text: discard them unread.
      await response.body?.cancel().catch(() => undefined);
      const status = response.type === 'opaqueredirect' ? null : response.status;
      throw new LanguageToolError('HTTP_ERROR', describeHttpFailure(status ?? 0, response.type), {
        endpoint,
        ...(status !== null && { httpStatus: status }),
      });
    }
    return response;
  }

  /** Reads the body as UTF-8, aborting as soon as it exceeds maxResponseBytes. */
  private async readBody(response: Response, endpoint: string, signal: AbortSignal): Promise<string> {
    const tooLarge = () =>
      new LanguageToolError('INVALID_RESPONSE', `LanguageTool response exceeds the ${this.maxResponseBytes}-byte limit`, {
        endpoint,
        httpStatus: response.status,
      });

    const declaredLength = Number(response.headers.get('Content-Length') ?? 0);
    if (declaredLength > this.maxResponseBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw tooLarge();
    }
    if (response.body === null) {
      return '';
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        received += value.byteLength;
        if (received > this.maxResponseBytes) {
          await reader.cancel().catch(() => undefined);
          throw tooLarge();
        }
        chunks.push(value);
      }
      return new TextDecoder().decode(Buffer.concat(chunks));
    } catch (error) {
      if (error instanceof LanguageToolError) {
        throw error;
      }
      if (signal.aborted) {
        throw this.toTransportError(error, endpoint, response.status);
      }
      throw new LanguageToolError('INVALID_RESPONSE', 'Failed to read the LanguageTool response body', {
        endpoint,
        httpStatus: response.status,
        cause: error,
      });
    }
  }

  /** `httpStatus` is set when the failure happened after the response headers were received. */
  private toTransportError(error: unknown, endpoint: string, httpStatus?: number): LanguageToolError {
    if (isTimeoutError(error)) {
      const message =
        httpStatus === undefined
          ? `LanguageTool did not answer within ${this.timeoutMs} ms (${this.baseUrl})`
          : `LanguageTool sent HTTP ${httpStatus} headers but did not complete the response ` +
            `within ${this.timeoutMs} ms (${this.baseUrl})`;
      return new LanguageToolError('TIMEOUT', message, { endpoint, httpStatus, cause: error });
    }
    const code = networkErrorCode(error);
    return new LanguageToolError(
      'UNREACHABLE',
      `LanguageTool is unreachable at ${this.baseUrl}${code ? ` (${code})` : ''}`,
      { endpoint, cause: error },
    );
  }
}

function describeHttpFailure(status: number, type: ResponseType): string {
  if (type === 'opaqueredirect' || (status >= 300 && status < 400)) {
    return `LanguageTool answered HTTP ${status || '3xx'} (redirect not followed)`;
  }
  let category: string;
  if (status === 400) {
    category = 'request rejected, e.g. unknown language code or rule id';
  } else if (status === 413) {
    category = 'request too large';
  } else if (status === 429) {
    category = 'too many requests';
  } else if (status >= 400 && status < 500) {
    category = 'client error';
  } else if (status >= 500 && status < 600) {
    category = 'server error';
  } else {
    category = 'unexpected status';
  }
  return `LanguageTool answered HTTP ${status} (${category})`;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Extracts a system error code such as ECONNREFUSED from undici's "fetch failed" TypeError. */
function networkErrorCode(error: unknown): string | undefined {
  const cause = error instanceof Error ? error.cause : undefined;
  if (typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string') {
    return cause.code;
  }
  return undefined;
}
