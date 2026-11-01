/*
 * Library entry point. Creating the integrations performs no I/O: no request, no process, no file
 * read. Consent is evaluated separately on every metadata call.
 */
import { loadConfig } from './config.js';
import { MetadataProviders, type TestOptions } from './providers.js';
import { checkVale } from './vale.js';

export function createIntegrations(env: NodeJS.ProcessEnv = process.env, tests: TestOptions = {}) {
  const config = loadConfig(env);
  const providers = new MetadataProviders(config, tests);
  return {
    crossrefLookup: (input: unknown) => providers.crossrefLookup(input),
    crossrefSearch: (input: unknown) => providers.crossrefSearch(input),
    openalexLookup: (input: unknown) => providers.openalexLookup(input),
    openalexSearch: (input: unknown) => providers.openalexSearch(input),
    zoteroGet: (input: unknown) => providers.zoteroGet(input),
    zoteroSearch: (input: unknown) => providers.zoteroSearch(input),
    valeCheck: (input: unknown) => checkVale(config, input),
  };
}
export type Integrations = ReturnType<typeof createIntegrations>;

export { loadConfig } from './config.js';
export { compareMetadata, compareProviderRecords } from './metadata.js';
export { IntegrationError, LIMITS, normalizeDoi } from './contracts.js';
export type { DoiVerification, EvidenceRecord, Expected, Metadata, Provenance, ProviderResult, Status } from './contracts.js';
export type { ValeResult } from './vale.js';
