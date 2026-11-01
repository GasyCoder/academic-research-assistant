import { createRequire } from 'node:module';

/**
 * The package version, which follows the repository version (docs/releasing.md). package.json sits
 * one level above both src/ and dist/; the path is resolved from this module.
 */
export const VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

/** Identifies the application to providers; an operator contact is appended only when configured. */
export const USER_AGENT = `academic-research-assistant/${VERSION} (+https://github.com/GasyCoder/academic-research-assistant)`;
