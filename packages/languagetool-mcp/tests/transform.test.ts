import { describe, expect, it } from 'vitest';

import { rawCheckResponseSchema, rawLanguagesSchema } from '../src/languagetool-schemas.js';
import { toCheckTextResult, toLanguageIssue, toSupportedLanguages } from '../src/transform.js';
import { checkTextResultSchema, supportedLanguagesResultSchema } from '../src/types.js';
import {
  emptyCheckResponse,
  englishCheckResponse,
  englishText,
  frenchCheckResponse,
  frenchText,
  languagesResponse,
} from './fixtures/languagetool-responses.js';

const parseCheck = (body: unknown) => rawCheckResponseSchema.parse(body);

describe('toCheckTextResult', () => {
  it('maps a French grammar issue with every documented field', () => {
    const result = toCheckTextResult(parseCheck(frenchCheckResponse), 'fr');

    expect(result.issues[0]).toEqual({
      message: 'Dans l’expression suivante, la préposition « a » possède un accent grave.',
      shortMessage: null,
      offset: 13,
      length: 1,
      replacements: ['à'],
      sentence: 'Je suis allé a la plage hier.',
      context: { text: frenchText, offset: 13, length: 1 },
      ruleId: 'A_A_ACCENT',
      ruleSubId: '4',
      ruleDescription: "'A' au lieu de 'À'",
      issueType: 'uncategorized',
      categoryId: 'CAT_HOMONYMES_PARONYMES',
      categoryName: 'Confusion d’homonymes et paronymes',
    });
    expect(frenchText.slice(result.issues[0]!.offset, result.issues[0]!.offset + result.issues[0]!.length)).toBe('a');
  });

  it('reports metadata: requested, used and detected language, version, counts', () => {
    const result = toCheckTextResult(parseCheck(frenchCheckResponse), 'fr');

    expect(result.requestedLanguage).toBe('fr');
    expect(result.language).toEqual({ name: 'French', code: 'fr' });
    expect(result.detectedLanguage).toEqual({ name: 'French', code: 'fr', confidence: 0.9999953 });
    expect(result.software).toEqual({
      name: 'LanguageTool',
      version: '6.9-SNAPSHOT',
      buildDate: '2026-10-29 18:47:38 +0100',
      apiVersion: 1,
    });
    expect(result.incompleteResults).toBe(false);
    expect(result.issueCount).toBe(2);
    expect(checkTextResultSchema.safeParse(result).success).toBe(true);
  });

  it('keeps every suggestion in LanguageTool order', () => {
    const result = toCheckTextResult(parseCheck(englishCheckResponse), 'en-US');
    const [issue] = result.issues;

    expect(issue!.replacements).toEqual(['simple', 'sample', 'ample', 'smile', 'Siple']);
    expect(issue!.shortMessage).toBe('Spelling mistake');
    expect(issue!.issueType).toBe('misspelling');
    expect(issue!.ruleSubId).toBeNull();
    expect(englishText.slice(issue!.offset, issue!.offset + issue!.length)).toBe('smple');
  });

  it('keeps multiple suggestions of a French issue', () => {
    const result = toCheckTextResult(parseCheck(frenchCheckResponse), 'fr');
    expect(result.issues[1]!.replacements).toEqual(['Ils ont', 'Il a']);
  });

  it('handles a response without any issue', () => {
    const result = toCheckTextResult(parseCheck(emptyCheckResponse), 'en-US');
    expect(result.issueCount).toBe(0);
    expect(result.issues).toEqual([]);
    expect(checkTextResultSchema.safeParse(result).success).toBe(true);
  });

  it('uses null for optional data LanguageTool omitted', () => {
    const minimal = parseCheck({
      software: { name: 'LanguageTool', version: '6.0' },
      language: { name: 'English', code: 'en' },
      matches: [{ message: 'm', offset: 0, length: 1, rule: { id: 'R' } }],
    });
    const result = toCheckTextResult(minimal, 'auto');

    expect(result.detectedLanguage).toBeNull();
    expect(result.incompleteResults).toBeNull();
    expect(result.software.buildDate).toBeNull();
    expect(result.issues[0]).toMatchObject({
      replacements: [],
      sentence: null,
      context: null,
      categoryId: null,
      categoryName: null,
    });
    expect(checkTextResultSchema.safeParse(result).success).toBe(true);
  });

  it('propagates incompleteResults when LanguageTool flags it', () => {
    const result = toCheckTextResult(
      parseCheck({ ...emptyCheckResponse, warnings: { incompleteResults: true } }),
      'en-US',
    );
    expect(result.incompleteResults).toBe(true);
  });
});

describe('toLanguageIssue', () => {
  it('ignores replacements without a value', () => {
    const issue = toLanguageIssue({
      message: 'm',
      offset: 0,
      length: 1,
      replacements: [{ value: 'a' }, {}, { value: null }, { value: 'b' }],
      rule: { id: 'R' },
    });
    expect(issue.replacements).toEqual(['a', 'b']);
  });
});

describe('toSupportedLanguages', () => {
  it('lists languages as reported and groups variants by base code', () => {
    const result = toSupportedLanguages(rawLanguagesSchema.parse(languagesResponse));

    expect(result.count).toBe(6);
    expect(result.languages[1]).toEqual({ name: 'English (US)', code: 'en', longCode: 'en-US' });
    expect(result.variantsByCode).toEqual({
      en: ['en', 'en-US', 'en-GB'],
      fr: ['fr', 'fr-CA'],
      ar: ['ar'],
    });
    expect(supportedLanguagesResultSchema.safeParse(result).success).toBe(true);
  });

  it('falls back to code when longCode is absent', () => {
    const result = toSupportedLanguages([{ name: 'Esperanto', code: 'eo' }]);
    expect(result.languages).toEqual([{ name: 'Esperanto', code: 'eo', longCode: 'eo' }]);
  });
});
