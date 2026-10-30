import type { McpServer } from '@modelcontextprotocol/server';

import type { LanguageToolClient } from '../languagetool-client.js';
import { toSupportedLanguages } from '../transform.js';
import { type SupportedLanguagesResult, supportedLanguagesResultSchema } from '../types.js';
import { toolFailure, toolSuccess } from './results.js';

/** Languages actually installed on the LanguageTool server, as it reports them. */
export async function runGetSupportedLanguages(client: LanguageToolClient): Promise<SupportedLanguagesResult> {
  return toSupportedLanguages(await client.getLanguages());
}

export function registerGetSupportedLanguagesTool(server: McpServer, client: LanguageToolClient): void {
  server.registerTool(
    'get_supported_languages',
    {
      title: 'LanguageTool supported languages',
      description:
        'List the languages and regional variants available on the configured LanguageTool server. ' +
        'Use a `longCode` (e.g. "en-US", "fr") as the `language` argument of check_text.',
      outputSchema: supportedLanguagesResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        return toolSuccess(await runGetSupportedLanguages(client));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
}
