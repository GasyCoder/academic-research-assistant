#!/usr/bin/env node
/*
 * stdio entry point. stdout carries the MCP protocol exclusively; diagnostics go to stderr and
 * never include configuration values, queries, metadata or text.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createServer, SERVER_NAME } from './server.js';
import { createIntegrations } from './service.js';

function log(message: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

function main(): void {
  // Node would otherwise print the message and stack of an uncaught error.
  process.on('uncaughtException', (error) => {
    log(`fatal error (${error.name})`);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    log(`fatal error (${reason instanceof Error ? reason.name : typeof reason})`);
    process.exit(1);
  });

  let service;
  try {
    service = createIntegrations();
  } catch {
    log('invalid integration configuration');
    process.exit(1);
  }
  serveStdio(() => createServer(service), {
    onerror: (error) => log(`transport error (${error.name})`),
  });
  log('ready; read-only tools; metadata requests need per-call network consent');
}

main();
