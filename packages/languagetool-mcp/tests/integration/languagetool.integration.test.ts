/*
 * Optional checks against a real LanguageTool server.
 * Skipped unless LANGUAGETOOL_INTEGRATION=1 (see `npm run test:integration`).
 * Target: LANGUAGETOOL_BASE_URL, default http://127.0.0.1:8081.
 */
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';
import { DEFAULT_MAX_TEXT_LENGTH, LanguageToolClient } from '../../src/languagetool-client.js';
import { runCheckText } from '../../src/tools/check-text.js';
import { runGetSupportedLanguages } from '../../src/tools/get-supported-languages.js';
import { runHealthCheck } from '../../src/tools/health-check.js';

const enabled = process.env.LANGUAGETOOL_INTEGRATION === '1';
const config = loadConfig();

// The first check in a language took 4.6–10 s on a cold server, beyond Vitest's 5 s default:
// let each test run as long as the client itself waits.
describe.skipIf(!enabled)('LanguageTool integration', { timeout: config.timeoutMs + 5_000 }, () => {
  const client = new LanguageToolClient(config);

  it('reports a healthy server with its version', async () => {
    const result = await runHealthCheck(client);
    expect(result.error).toBeNull();
    expect(result.status).toBe('ok');
    expect(result.software?.name).toBe('LanguageTool');
  });

  it('lists installed languages', async () => {
    const result = await runGetSupportedLanguages(client);
    expect(result.count).toBeGreaterThan(0);
    expect(result.languages.every((language) => language.longCode.length > 0)).toBe(true);
  });

  it('detects an English agreement error', async () => {
    const text = 'This are a test.';
    const result = await runCheckText(client, { text, language: 'en-US' });
    expect(result.language.code).toBe('en-US');
    expect(result.issueCount).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue.offset + issue.length).toBeLessThanOrEqual(text.length);
    }
  });

  it('detects a French accent error', async () => {
    const text = 'Il est allé a la plage.';
    const result = await runCheckText(client, { text, language: 'fr' });
    const issue = result.issues.find((candidate) => text.slice(candidate.offset, candidate.offset + candidate.length) === 'a');
    expect(issue?.replacements).toContain('à');
  });

  it('reports offsets in UTF-16 code units after surrogate pairs', async () => {
    const text = '😀😀 This are a test.';
    const result = await runCheckText(client, { text, language: 'en-US' });
    const flagged = result.issues.map((issue) => text.slice(issue.offset, issue.offset + issue.length));
    // A code-point offset would be 3 and would not land on "This".
    expect(flagged.some((fragment) => fragment.startsWith('This'))).toBe(true);
  });

  it('checks a text of exactly the input limit within the configured timeout', async () => {
    const sentence = 'The measurments was performed twice, and the results are consistent. ';
    const text = sentence.repeat(Math.ceil(DEFAULT_MAX_TEXT_LENGTH / sentence.length)).slice(0, DEFAULT_MAX_TEXT_LENGTH);
    const result = await runCheckText(client, { text, language: 'en-US' });
    expect(result.issueCount).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue.offset + issue.length).toBeLessThanOrEqual(text.length);
    }
  });

  it('reports an unknown language as an HTTP error', async () => {
    await expect(runCheckText(client, { text: 'Hello', language: 'xx-YY' })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      httpStatus: 400,
    });
  });
});
