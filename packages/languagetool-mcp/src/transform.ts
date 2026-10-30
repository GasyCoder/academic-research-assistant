import type { RawCheckResponse, RawLanguage, RawMatch, RawSoftware } from './languagetool-schemas.js';
import type { CheckTextResult, LanguageIssue, SoftwareInfo, SupportedLanguagesResult } from './types.js';

/*
 * Pure mappings from raw LanguageTool payloads to the normalized tool results.
 * They copy LanguageTool's diagnostics as-is: no filtering, ranking or rewriting.
 */

export function toSoftwareInfo(raw: RawSoftware): SoftwareInfo {
  return {
    name: raw.name,
    version: raw.version,
    buildDate: raw.buildDate ?? null,
    apiVersion: raw.apiVersion ?? null,
  };
}

export function toSupportedLanguages(raw: readonly RawLanguage[]): SupportedLanguagesResult {
  const languages = raw.map((language) => ({
    name: language.name,
    code: language.code,
    longCode: language.longCode ?? language.code,
  }));

  // Codes come from the server: a Map avoids inherited keys such as "constructor" or "__proto__".
  const variants = new Map<string, string[]>();
  for (const language of languages) {
    const longCodes = variants.get(language.code) ?? [];
    if (!longCodes.includes(language.longCode)) {
      longCodes.push(language.longCode);
    }
    variants.set(language.code, longCodes);
  }

  // Object.fromEntries defines own properties, so "__proto__" stays a plain key.
  return { count: languages.length, languages, variantsByCode: Object.fromEntries(variants) };
}

export function toLanguageIssue(match: RawMatch): LanguageIssue {
  return {
    message: match.message,
    shortMessage: match.shortMessage || null,
    offset: match.offset,
    length: match.length,
    replacements: (match.replacements ?? [])
      .map((replacement) => replacement.value)
      .filter((value): value is string => typeof value === 'string'),
    sentence: match.sentence ?? null,
    context: match.context ?? null,
    ruleId: match.rule.id,
    ruleSubId: match.rule.subId ?? null,
    ruleDescription: match.rule.description ?? null,
    issueType: match.rule.issueType ?? null,
    categoryId: match.rule.category?.id ?? null,
    categoryName: match.rule.category?.name ?? null,
  };
}

export function toCheckTextResult(raw: RawCheckResponse, requestedLanguage: string): CheckTextResult {
  const detected = raw.language.detectedLanguage;
  const issues = raw.matches.map(toLanguageIssue);
  return {
    requestedLanguage,
    language: { name: raw.language.name, code: raw.language.code },
    detectedLanguage: detected
      ? { name: detected.name, code: detected.code, confidence: detected.confidence ?? null }
      : null,
    software: toSoftwareInfo(raw.software),
    incompleteResults: raw.warnings?.incompleteResults ?? null,
    issueCount: issues.length,
    issues,
  };
}
