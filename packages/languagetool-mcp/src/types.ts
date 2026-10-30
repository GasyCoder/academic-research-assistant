import { z } from 'zod';

/*
 * Normalized results returned by the MCP tools.
 * These schemas double as MCP output schemas, so absent values are explicit
 * `null` rather than missing keys to keep the structure predictable for clients.
 */

export const toolErrorSchema = z.object({
  code: z.enum(['TIMEOUT', 'UNREACHABLE', 'HTTP_ERROR', 'INVALID_RESPONSE', 'INTERNAL_ERROR']),
  message: z.string(),
  endpoint: z.string().nullable(),
  httpStatus: z.number().int().nullable(),
});

export const softwareInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildDate: z.string().nullable(),
  apiVersion: z.number().nullable(),
});

export const healthCheckResultSchema = z.object({
  status: z
    .enum(['ok', 'unhealthy', 'unavailable'])
    .describe('ok: healthy; unhealthy: answered with an error; unavailable: no answer (offline or timeout)'),
  reachable: z.boolean().describe('Whether an HTTP response was received from LanguageTool'),
  baseUrl: z.string(),
  software: softwareInfoSchema.nullable().describe('Server version, when it can be retrieved'),
  error: toolErrorSchema.nullable(),
});

export const supportedLanguageSchema = z.object({
  name: z.string(),
  code: z.string().describe('Base language code, e.g. "en"'),
  longCode: z.string().describe('Code to pass to check_text, e.g. "en-US"'),
});

export const supportedLanguagesResultSchema = z.object({
  count: z.number().int(),
  languages: z.array(supportedLanguageSchema),
  variantsByCode: z
    .record(z.string(), z.array(z.string()))
    .describe('All longCodes available for each base code, e.g. { "en": ["en", "en-US", "en-GB"] }'),
});

export const languageIssueSchema = z.object({
  message: z.string(),
  shortMessage: z.string().nullable(),
  offset: z.number().int().describe('Start of the issue in the submitted text (UTF-16 code units)'),
  length: z.number().int(),
  replacements: z.array(z.string()).describe('Suggestions in LanguageTool order; may be empty'),
  sentence: z.string().nullable(),
  context: z
    .object({
      text: z.string(),
      offset: z.number().int().describe('Start of the issue within context.text'),
      length: z.number().int(),
    })
    .nullable(),
  ruleId: z.string(),
  ruleSubId: z.string().nullable(),
  ruleDescription: z.string().nullable(),
  issueType: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
});

export const checkTextResultSchema = z.object({
  requestedLanguage: z.string(),
  language: z.object({ name: z.string(), code: z.string() }).describe('Language LanguageTool checked against'),
  detectedLanguage: z
    .object({ name: z.string(), code: z.string(), confidence: z.number().nullable() })
    .nullable(),
  software: softwareInfoSchema,
  incompleteResults: z.boolean().nullable(),
  issueCount: z.number().int(),
  issues: z.array(languageIssueSchema),
});

export type ToolError = z.infer<typeof toolErrorSchema>;
export type SoftwareInfo = z.infer<typeof softwareInfoSchema>;
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type SupportedLanguagesResult = z.infer<typeof supportedLanguagesResultSchema>;
export type LanguageIssue = z.infer<typeof languageIssueSchema>;
export type CheckTextResult = z.infer<typeof checkTextResultSchema>;
