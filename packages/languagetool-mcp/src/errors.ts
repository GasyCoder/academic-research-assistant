export type LanguageToolErrorCode =
  /** The request did not complete within the configured timeout. */
  | 'TIMEOUT'
  /** No HTTP response: connection refused, DNS failure, reset, etc. */
  | 'UNREACHABLE'
  /** LanguageTool answered with a non-2xx status. */
  | 'HTTP_ERROR'
  /** LanguageTool answered 2xx but the body is not valid JSON or lacks required fields. */
  | 'INVALID_RESPONSE'
  /** The text exceeds the per-check length limit; it was not sent. The caller must split it. */
  | 'TEXT_TOO_LONG';

export interface LanguageToolErrorDetails {
  code: LanguageToolErrorCode;
  message: string;
  /** API path that failed, e.g. /v2/check. Never contains request content. */
  endpoint: string;
  /** Status of the HTTP response; non-null exactly when response headers were received. */
  httpStatus: number | null;
}

/**
 * Error raised by the LanguageTool HTTP client.
 * Messages only carry technical information, never the analysed text.
 */
export class LanguageToolError extends Error {
  override name = 'LanguageToolError';
  readonly code: LanguageToolErrorCode;
  readonly endpoint: string;
  readonly httpStatus: number | null;

  constructor(
    code: LanguageToolErrorCode,
    message: string,
    options: { endpoint: string; httpStatus?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.code = code;
    this.endpoint = options.endpoint;
    this.httpStatus = options.httpStatus ?? null;
  }

  toDetails(): LanguageToolErrorDetails {
    return { code: this.code, message: this.message, endpoint: this.endpoint, httpStatus: this.httpStatus };
  }
}
