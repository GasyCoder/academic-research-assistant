/*
 * Optional checks against a real LanguageTool server.
 * Skipped unless LANGUAGETOOL_INTEGRATION=1 (see `npm run test:integration`).
 * Target: LANGUAGETOOL_BASE_URL, default http://127.0.0.1:8081.
 */
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';
import { DEFAULT_MAX_TEXT_LENGTH, LanguageToolClient } from '../../src/languagetool-client.js';
import { runCheckDocument } from '../../src/tools/check-document.js';
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

  it(
    'checks a French document longer than check_text accepts, with exact offsets after several chunks',
    async () => {
      const sentences = [
        'Les résultats obtenus montrent une amélioration nette de la précision des mesures.',
        'Les données ont été collectées auprès de plusieurs établissements partenaires.',
        "L'analyse statistique a été réalisée avec un seuil de significativité fixé à 5 %.",
        'Le modèle a été validé sur un jeu de données indépendant.',
      ];
      const paragraphs = Array.from({ length: 330 }, (_, index) =>
        Array.from({ length: 3 }, (_, offset) => sentences[(index + offset) % sentences.length]).join(' '),
      );
      // A known error in the last paragraph, after characters outside the BMP.
      paragraphs.push('Pour finir 😀😀, il est allé a la plage.');
      const text = paragraphs.join('\n\n');
      expect(text.length).toBeGreaterThan(DEFAULT_MAX_TEXT_LENGTH);

      const result = await runCheckDocument(client, { text, language: 'fr' });

      expect(result.chunkCount).toBeGreaterThanOrEqual(2);
      expect(result.complete).toBe(true);
      for (const issue of result.issues) {
        expect(issue.offset + issue.length).toBeLessThanOrEqual(text.length);
      }
      const accent = text.lastIndexOf(' a la plage') + 1;
      const issue = result.issues.find((candidate) => candidate.offset === accent);
      expect(issue).toMatchObject({ length: 1 });
      expect(issue?.replacements).toContain('à');
    },
    2 * config.timeoutMs + 5_000,
  );

  it('finds the issues check_text finds when a text is checked in small chunks', async () => {
    const sentences = [
      'This are a test of the propsed method.',
      'The measurments was performed twice, and the results are consistent.',
      'We discuss the implications of these results for future work.',
      'The participants was recruited according to predefined criteria.',
    ];
    const text = Array.from({ length: 60 }, (_, index) =>
      Array.from({ length: 4 }, (_, offset) => sentences[(index + offset) % sentences.length]).join(' '),
    ).join('\n\n');
    const key = (issue: { offset: number; length: number; ruleId: string }) => `${issue.offset}:${issue.length}:${issue.ruleId}`;

    const whole = new Set((await runCheckText(client, { text, language: 'en-US' })).issues.map(key));
    // Requests of 3,000 units: about five times more cuts than the text has chunks of the default size.
    const smallChunks = new LanguageToolClient({ ...config, maxTextLength: 3_000 });
    const result = await runCheckDocument(smallChunks, { text, language: 'en-US' }, {}, { contextLength: 300 });
    const chunked = new Set(result.issues.map(key));

    expect(result.chunkCount).toBeGreaterThanOrEqual(4);
    expect([...chunked].filter((entry) => !whole.has(entry))).toEqual([]);
    expect([...whole].filter((entry) => !chunked.has(entry)).length).toBeLessThanOrEqual(whole.size * 0.02);
  });

  it('reports an unknown language as an HTTP error', async () => {
    await expect(runCheckText(client, { text: 'Hello', language: 'xx-YY' })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      httpStatus: 400,
    });
  });
});
