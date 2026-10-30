import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { LanguageToolClient } from '../languagetool-client.js';
import { toCheckTextResult } from '../transform.js';
import { type CheckTextResult, checkTextResultSchema } from '../types.js';
import { toolFailure, toolSuccess } from './results.js';

/** "auto" or a BCP 47-like tag such as "fr", "en-US", "ca-ES-valencia". LanguageTool validates the exact value. */
const LANGUAGE_CODE_PATTERN = /^(auto|[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*)$/;
/** LanguageTool rule and category ids; commas are excluded because lists are sent comma-separated. */
const RULE_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;

const identifierListSchema = z.array(z.string().regex(RULE_ID_PATTERN).max(200)).max(200);

export const checkTextInputSchema = z.object({
  text: z
    .string()
    .refine((value) => value.trim().length > 0, { message: 'text must not be empty' })
    .describe('Text to analyse. It is sent unchanged to LanguageTool and is never rewritten.'),
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
});

export type CheckTextInput = z.infer<typeof checkTextInputSchema>;

/** Returns LanguageTool's diagnostics for the text. The text itself is never modified. */
export async function runCheckText(client: LanguageToolClient, input: CheckTextInput): Promise<CheckTextResult> {
  const raw = await client.check(input);
  return toCheckTextResult(raw, input.language);
}

export function registerCheckTextTool(server: McpServer, client: LanguageToolClient): void {
  server.registerTool(
    'check_text',
    {
      title: 'LanguageTool text check',
      description:
        'Analyse text with LanguageTool and return the detected spelling, grammar and style issues as structured data ' +
        '(message, offset/length in UTF-16 code units, replacements, rule and category). ' +
        'This tool only reports issues: it never rewrites the text, and replacements are suggestions to be judged by the caller. ' +
        'The first check in a language can take several seconds while LanguageTool loads it; ' +
        'after a TIMEOUT, health_check tells a slow LanguageTool (status ok) from an unavailable one.',
      inputSchema: checkTextInputSchema,
      outputSchema: checkTextResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        return toolSuccess(await runCheckText(client, input));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
}
