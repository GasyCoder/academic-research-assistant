import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { DEFAULT_MAX_TEXT_LENGTH, type LanguageToolClient } from '../languagetool-client.js';
import { toCheckTextResult } from '../transform.js';
import { type CheckTextResult, checkTextResultSchema } from '../types.js';
import { checkOptionsShape, textInputSchema } from './check-options.js';
import { toolFailure, toolSuccess } from './results.js';

export const checkTextInputSchema = z.object({
  // The client enforces the length limit.
  text: textInputSchema(
    DEFAULT_MAX_TEXT_LENGTH,
    `Text to analyse, at most ${DEFAULT_MAX_TEXT_LENGTH} characters (UTF-16 code units); a longer text is ` +
      'rejected with TEXT_TOO_LONG, never truncated. It is sent unchanged to LanguageTool and is never rewritten.',
  ),
  ...checkOptionsShape,
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
        'after a TIMEOUT, health_check reports HTTP liveness; status ok does not establish language readiness.',
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
