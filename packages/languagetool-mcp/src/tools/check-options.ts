import { z } from 'zod';

/*
 * Input fields shared by check_text and check_document, so that both tools
 * accept the same languages and LanguageTool options.
 */

/** "auto" or a BCP 47-like tag such as "fr", "en-US", "ca-ES-valencia". LanguageTool validates the exact value. */
const LANGUAGE_CODE_PATTERN = /^(auto|[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*)$/;
/** LanguageTool rule and category ids; commas are excluded because lists are sent comma-separated. */
const RULE_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;

const identifierListSchema = z.array(z.string().regex(RULE_ID_PATTERN).max(200)).max(200);

/**
 * Non-blank text whose maximum length is only advertised: the tool enforces it, so that the caller
 * gets a structured TEXT_TOO_LONG error rather than the SDK's plain-text validation message.
 */
export function textInputSchema(maxLength: number, description: string) {
  return z
    .string()
    .refine((value) => value.trim().length > 0, { message: 'text must not be empty' })
    .meta({ description, maxLength });
}

export const checkOptionsShape = {
  language: z
    .string()
    .trim()
    .max(64)
    .regex(LANGUAGE_CODE_PATTERN, { message: 'language must be a language code such as "en-US" or "fr", or "auto"' })
    .describe('Language code from get_supported_languages (e.g. "en-US", "fr"), or "auto" for detection.'),
  level: z
    .enum(['default', 'picky'])
    .optional()
    .describe('"picky" enables additional, stricter LanguageTool rules.'),
  disabledRules: identifierListSchema.optional().describe('LanguageTool rule ids to ignore (e.g. "WHITESPACE_RULE").'),
  disabledCategories: identifierListSchema
    .optional()
    .describe('LanguageTool category ids to ignore (e.g. "TYPOGRAPHY").'),
};
