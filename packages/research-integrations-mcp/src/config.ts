/*
 * Operator configuration, read from the environment only. Tools cannot change it, and no value is
 * ever echoed: an invalid variable produces a fixed error without its content.
 * Credentials belong here, never in a Research Profile, a tool argument or a committed file.
 */
import { isAbsolute } from 'node:path';

import { IntegrationError, LIMITS } from './contracts.js';

export interface Config {
  /** Covers connection, headers and the whole body of one HTTP call, and the whole Vale run. */
  timeoutMs: number;
  responseBytes: number;
  /** 0 disables the in-memory cache of public metadata. */
  cacheTtlMs: number;
  /** Email for Crossref's polite pool, set by the operator; never in results or provenance. */
  crossrefContact?: string;
  openalexKey?: string;
  zoteroKey?: string;
  /** Opt-in for the Zotero Desktop local API on the fixed loopback address. */
  zoteroLocal: boolean;
  valePath?: string;
  valeConfig?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Readonly<Config> {
  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const raw = env[name];
    if (raw === undefined) {
      return fallback;
    }
    if (!/^\d+$/u.test(raw) || Number(raw) < min || Number(raw) > max) {
      throw new IntegrationError('CONFIGURATION_ERROR');
    }
    return Number(raw);
  };
  // Keys are opaque header values: a restricted alphabet rules out header injection.
  const key = (name: string): string | undefined => {
    const value = env[name];
    if (value !== undefined && !/^[A-Za-z0-9._~-]{8,512}$/u.test(value)) {
      throw new IntegrationError('CONFIGURATION_ERROR');
    }
    return value;
  };
  const absolutePath = (name: string): string | undefined => {
    const value = env[name];
    if (value !== undefined && (!isAbsolute(value) || /[\u0000-\u001f]/u.test(value))) {
      throw new IntegrationError('CONFIGURATION_ERROR');
    }
    return value;
  };

  const crossrefContact = env.ARA_CROSSREF_CONTACT;
  if (
    crossrefContact !== undefined &&
    (crossrefContact.length > 254 || !/^[A-Za-z0-9._+%~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(crossrefContact))
  ) {
    throw new IntegrationError('CONFIGURATION_ERROR');
  }
  const zoteroLocal = env.ARA_ZOTERO_LOCAL;
  if (zoteroLocal !== undefined && zoteroLocal !== '0' && zoteroLocal !== '1') {
    throw new IntegrationError('CONFIGURATION_ERROR');
  }

  return Object.freeze({
    timeoutMs: integer('ARA_INTEGRATIONS_TIMEOUT_MS', 10_000, 100, 60_000),
    responseBytes: integer('ARA_INTEGRATIONS_RESPONSE_BYTES', LIMITS.responseBytes, 1024, 8 * 1024 * 1024),
    cacheTtlMs: integer('ARA_INTEGRATIONS_CACHE_TTL_MS', 60_000, 0, 300_000),
    crossrefContact,
    openalexKey: key('ARA_OPENALEX_API_KEY'),
    zoteroKey: key('ARA_ZOTERO_API_KEY'),
    zoteroLocal: zoteroLocal === '1',
    valePath: absolutePath('ARA_VALE_PATH'),
    valeConfig: absolutePath('ARA_VALE_CONFIG'),
  });
}

/** Configured values that must never appear in a result, provenance, error or log. */
export function secretsOf(config: Config): string[] {
  return [config.openalexKey, config.zoteroKey, config.crossrefContact].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

/** Percent-decodes up to three times, tolerating malformed or partial escapes. */
function decodedForms(value: string): string[] {
  const forms = [value];
  let current = value;
  for (let round = 0; round < 3 && /%[0-9a-f]{2}/iu.test(current); round += 1) {
    try {
      current = decodeURIComponent(current);
    } catch {
      current = current.replace(/%([0-9a-f]{2})/giu, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    }
    forms.push(current);
  }
  return forms;
}

/**
 * True if a string echoes a configured secret, raw or percent-encoded (fully, partly, any case).
 * Secrets are only sent in headers or the Crossref mailto, so a match can only be an echo.
 */
export function containsSecret(value: string, secrets: readonly string[]): boolean {
  if (secrets.length === 0) {
    return false;
  }
  return decodedForms(value).some((form) => secrets.some((secret) => form.includes(secret)));
}

/**
 * Replaces every string value that echoes a secret with "[REDACTED]", recursively. Only values
 * are inspected: property names and the caller's trusted protocol fields are left to the caller,
 * which applies this to provider-derived and caller-supplied free-form data only.
 */
export function redact<T>(value: T, secrets: readonly string[]): T {
  if (typeof value === 'string') {
    return (containsSecret(value, secrets) ? '[REDACTED]' : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, secrets)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, secrets)])) as T;
  }
  return value;
}
