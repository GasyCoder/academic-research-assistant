import { z } from 'zod';

/*
 * Normalized results returned by the MCP tools.
 * These schemas double as MCP output schemas, so absent values are explicit
 * `null` rather than missing keys to keep the structure predictable for clients.
 */

const TOOL_ERROR_CODES = ['TIMEOUT', 'UNREACHABLE', 'HTTP_ERROR', 'INVALID_RESPONSE', 'TEXT_TOO_LONG', 'INTERNAL_ERROR'] as const;

export const toolErrorSchema = z.object({
  code: z.enum(TOOL_ERROR_CODES),
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
    .describe(
      'ok: healthy; unhealthy: LanguageTool answered but its response was an error, invalid, incomplete or too slow; ' +
        'unavailable: no HTTP response (offline, refused, or no answer before the timeout)',
    ),
  reachable: z.boolean().describe('Whether LanguageTool sent an HTTP response (status and headers)'),
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

export const documentIssueSchema = languageIssueSchema.extend({
  offset: z.number().int().describe('Start of the issue in the submitted document (UTF-16 code units)'),
  replacements: z.array(z.string()).describe('First suggestions in LanguageTool order; may be empty'),
  replacementsTruncated: z.boolean().describe('Whether LanguageTool suggested more replacements than returned'),
});

export const failedRangeSchema = z.object({
  chunkIndex: z.number().int(),
  start: z.number().int().describe('Start of a document range without diagnostics (UTF-16 code units)'),
  end: z.number().int().describe('End of the range, exclusive'),
  code: z
    .enum([...TOOL_ERROR_CODES, 'SKIPPED'])
    .describe('Error of the request for this range, or SKIPPED: not sent because processing stopped earlier'),
});

export const checkDocumentResultSchema = z.object({
  requestedLanguage: z.string(),
  languages: z
    .array(z.object({ name: z.string(), code: z.string() }))
    .describe('Languages LanguageTool checked against, in document order; several only with "auto" on a mixed document'),
  software: softwareInfoSchema,
  documentLength: z.number().int().describe('Length of the document in UTF-16 code units'),
  complete: z
    .boolean()
    .describe('true only if the whole document was checked and every diagnostic found is returned'),
  truncated: z
    .boolean()
    .describe('The output budget was reached: issues at or after truncatedAt are missing and later ranges were not checked'),
  truncatedAt: z.number().int().nullable().describe('Offset of the first issue left out, when truncated'),
  incompleteResults: z.boolean().describe('LanguageTool reported incomplete results for at least one range'),
  chunkCount: z.number().int(),
  processedChunkCount: z.number().int(),
  failedChunkCount: z.number().int(),
  skippedChunkCount: z.number().int(),
  failedRanges: z.array(failedRangeSchema).describe('Document ranges that were not checked, in document order'),
  issueCount: z.number().int(),
  issues: z.array(documentIssueSchema).describe('Issues in document order'),
});

export type ToolError = z.infer<typeof toolErrorSchema>;
export type SoftwareInfo = z.infer<typeof softwareInfoSchema>;
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type SupportedLanguagesResult = z.infer<typeof supportedLanguagesResultSchema>;
export type LanguageIssue = z.infer<typeof languageIssueSchema>;
export type CheckTextResult = z.infer<typeof checkTextResultSchema>;
export type DocumentIssue = z.infer<typeof documentIssueSchema>;
export type FailedRange = z.infer<typeof failedRangeSchema>;
export type CheckDocumentResult = z.infer<typeof checkDocumentResultSchema>;
