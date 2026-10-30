import { z } from 'zod';

/*
 * Schemas for the raw LanguageTool HTTP API (v2) responses.
 * Only fields consumed by this server are declared; unknown fields are dropped.
 * Fields LanguageTool always sends are required so that truncated or foreign
 * payloads are reported as INVALID_RESPONSE instead of producing partial data.
 */

export const rawSoftwareSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildDate: z.string().nullish(),
  apiVersion: z.number().nullish(),
  commit: z.string().nullish(),
});

export const rawInfoSchema = z.object({
  software: rawSoftwareSchema,
});

export const rawLanguageSchema = z.object({
  name: z.string(),
  code: z.string(),
  longCode: z.string().nullish(),
});

export const rawLanguagesSchema = z.array(rawLanguageSchema);

export const rawMatchSchema = z.object({
  message: z.string(),
  shortMessage: z.string().nullish(),
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  replacements: z.array(z.object({ value: z.string().nullish() })).nullish(),
  context: z
    .object({
      text: z.string(),
      offset: z.number().int().nonnegative(),
      length: z.number().int().nonnegative(),
    })
    .nullish(),
  sentence: z.string().nullish(),
  rule: z.object({
    id: z.string(),
    subId: z.string().nullish(),
    description: z.string().nullish(),
    issueType: z.string().nullish(),
    category: z
      .object({
        id: z.string().nullish(),
        name: z.string().nullish(),
      })
      .nullish(),
  }),
});

export const rawCheckResponseSchema = z.object({
  software: rawSoftwareSchema,
  warnings: z.object({ incompleteResults: z.boolean().nullish() }).nullish(),
  language: z.object({
    name: z.string(),
    code: z.string(),
    detectedLanguage: z
      .object({
        name: z.string(),
        code: z.string(),
        confidence: z.number().nullish(),
      })
      .nullish(),
  }),
  matches: z.array(rawMatchSchema),
});

export type RawSoftware = z.infer<typeof rawSoftwareSchema>;
export type RawInfo = z.infer<typeof rawInfoSchema>;
export type RawLanguage = z.infer<typeof rawLanguageSchema>;
export type RawMatch = z.infer<typeof rawMatchSchema>;
export type RawCheckResponse = z.infer<typeof rawCheckResponseSchema>;
