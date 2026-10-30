import { McpServer } from '@modelcontextprotocol/server';

import type { LanguageToolClient } from './languagetool-client.js';
import { registerCheckTextTool } from './tools/check-text.js';
import { registerGetSupportedLanguagesTool } from './tools/get-supported-languages.js';
import { registerHealthCheckTool } from './tools/health-check.js';

export const SERVER_NAME = 'languagetool-mcp';
/** Kept in sync with package.json (checked by tests). */
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS =
  'Generic adapter for a LanguageTool server. Tools return linguistic diagnostics only; ' +
  'they never modify the submitted text. Deciding which suggestion to apply is up to the caller.';

/** Builds an MCP server exposing the LanguageTool tools. Transport-agnostic. */
export function createServer(client: LanguageToolClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  registerHealthCheckTool(server, client);
  registerGetSupportedLanguagesTool(server, client);
  registerCheckTextTool(server, client);

  return server;
}
