#!/usr/bin/env node
/*
 * stdio entry point. stdout carries the MCP protocol exclusively:
 * diagnostics go to stderr and never include analysed text.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { ConfigError, loadConfig } from './config.js';
import { LanguageToolClient } from './languagetool-client.js';
import { SERVER_NAME, createServer } from './server.js';

function logError(message: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    logError(error instanceof ConfigError ? error.message : 'Failed to load configuration');
    process.exit(1);
  }

  const client = new LanguageToolClient(config);
  serveStdio(() => createServer(client), {
    // Transport errors may embed fragments of incoming messages (e.g. JSON parse errors), so only the type is logged.
    onerror: (error) => logError(`transport error (${error.name})`),
  });
  logError(`ready; LanguageTool at ${config.baseUrl}, timeout ${config.timeoutMs} ms`);
}

main();
