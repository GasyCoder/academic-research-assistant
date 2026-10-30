import { createRequire } from 'node:module';

import { McpServer } from '@modelcontextprotocol/server';

import { DEFAULT_MAX_TEXT_LENGTH, type LanguageToolClient } from './languagetool-client.js';
import { MAX_DOCUMENT_LENGTH, registerCheckDocumentTool } from './tools/check-document.js';
import { registerCheckTextTool } from './tools/check-text.js';
import { registerGetSupportedLanguagesTool } from './tools/get-supported-languages.js';
import { registerHealthCheckTool } from './tools/health-check.js';

export const SERVER_NAME = 'languagetool-mcp';
/**
 * The package version. package.json sits one level above both src/ and dist/, npm always ships it,
 * and the path is resolved from this module, not from the working directory.
 */
export const SERVER_VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

const INSTRUCTIONS =
  'Generic adapter for a LanguageTool server. Tools return linguistic diagnostics only; ' +
  'they never modify the submitted text. Deciding which suggestion to apply is up to the caller. ' +
  `Use check_text for a text of up to ${DEFAULT_MAX_TEXT_LENGTH} characters and check_document for a longer ` +
  `document of up to ${MAX_DOCUMENT_LENGTH} characters.`;

/** Builds an MCP server exposing the LanguageTool tools. Transport-agnostic. */
export function createServer(client: LanguageToolClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  registerHealthCheckTool(server, client);
  registerGetSupportedLanguagesTool(server, client);
  registerCheckTextTool(server, client);
  registerCheckDocumentTool(server, client);

  return server;
}
