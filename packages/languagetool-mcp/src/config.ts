import { z } from 'zod';

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8081';
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_TIMEOUT_MS = 300_000;

export interface LanguageToolConfig {
  /** Base URL of the LanguageTool server, without trailing slash (e.g. http://127.0.0.1:8081). */
  baseUrl: string;
  /** Timeout applied to every HTTP request sent to LanguageTool. */
  timeoutMs: number;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const baseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    const url = URL.canParse(value) ? new URL(value) : null;
    if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      ctx.addIssue({ code: 'custom', message: 'must be an absolute http:// or https:// URL' });
    } else if (url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
      ctx.addIssue({ code: 'custom', message: 'must not contain credentials, a query string or a fragment' });
    }
  })
  .transform((value) => value.replace(/\/+$/, ''));

const timeoutSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, { message: 'must be a positive integer (milliseconds)' })
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_TIMEOUT_MS));

/**
 * Reads the LanguageTool configuration from environment variables.
 * Unset or empty variables fall back to defaults; invalid values throw a ConfigError.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): LanguageToolConfig {
  return {
    baseUrl: parseVariable('LANGUAGETOOL_BASE_URL', env.LANGUAGETOOL_BASE_URL, baseUrlSchema, DEFAULT_BASE_URL),
    timeoutMs: parseVariable('LANGUAGETOOL_TIMEOUT_MS', env.LANGUAGETOOL_TIMEOUT_MS, timeoutSchema, DEFAULT_TIMEOUT_MS),
  };
}

function parseVariable<T>(name: string, raw: string | undefined, schema: z.ZodType<T, string>, fallback: T): T {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const reason = result.error.issues.map((issue) => issue.message).join('; ');
    throw new ConfigError(`Invalid ${name}: ${reason}`);
  }
  return result.data;
}
