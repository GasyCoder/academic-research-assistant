import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FetchLike, LanguageToolClient } from '../src/languagetool-client.js';
import { SERVER_NAME, SERVER_VERSION, createServer } from '../src/server.js';
import { englishCheckResponse, englishText } from './fixtures/languagetool-responses.js';
import { connectionRefused, createClient, jsonResponse, routeFetch } from './helpers.js';

type JsonRpcResult = { id: number; result?: Record<string, unknown>; error?: { message: string } };

/** Minimal JSON-RPC peer over an in-memory transport, so tests need no MCP client dependency. */
async function connect(fetchImpl: FetchLike, client: LanguageToolClient = createClient(fetchImpl)) {
  const server = createServer(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JsonRpcResult) => void>();
  clientTransport.onmessage = (message) => {
    const response = message as unknown as JsonRpcResult;
    pending.get(response.id)?.(response);
  };
  await server.connect(serverTransport);
  await clientTransport.start();

  let nextId = 1;
  const request = (method: string, params?: Record<string, unknown>) => {
    const id = nextId++;
    return new Promise<JsonRpcResult>((resolve) => {
      pending.set(id, resolve);
      void clientTransport.send({ jsonrpc: '2.0', id, method, params } as JSONRPCMessage);
    });
  };

  const init = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  await clientTransport.send({ jsonrpc: '2.0', method: 'notifications/initialized' } as JSONRPCMessage);

  return { init, request, close: () => server.close() };
}

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

describe('MCP server', () => {
  it('identifies itself with the package version', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    expect(SERVER_VERSION).toBe(packageJson.version);

    const session = await connect(routeFetch({}));
    close = session.close;
    expect(session.init.result?.serverInfo).toEqual({ name: SERVER_NAME, version: SERVER_VERSION });
  });

  it('exposes exactly the three LanguageTool tools', async () => {
    const session = await connect(routeFetch({}));
    close = session.close;
    const response = await session.request('tools/list');
    const tools = response.result?.tools as Array<{ name: string; outputSchema?: unknown; inputSchema: unknown }>;

    expect(tools.map((tool) => tool.name).sort()).toEqual(['check_text', 'get_supported_languages', 'health_check']);
    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
    }
    const checkText = tools.find((tool) => tool.name === 'check_text')!;
    expect(checkText.inputSchema).toMatchObject({ required: expect.arrayContaining(['text', 'language']) });
  });

  it('returns structured issues from check_text', async () => {
    const session = await connect(routeFetch({ 'POST /v2/check': () => jsonResponse(englishCheckResponse) }));
    close = session.close;
    const response = await session.request('tools/call', {
      name: 'check_text',
      arguments: { text: englishText, language: 'en-US' },
    });

    expect(response.result?.isError).toBeFalsy();
    expect(response.result?.structuredContent).toMatchObject({
      requestedLanguage: 'en-US',
      issueCount: 1,
      issues: [{ ruleId: 'MORFOLOGIK_RULE_EN_US', replacements: ['simple', 'sample', 'ample', 'smile', 'Siple'] }],
    });
  });

  it('rejects empty text before contacting LanguageTool', async () => {
    const fetchMock = routeFetch({});
    const session = await connect(fetchMock);
    close = session.close;
    const response = await session.request('tools/call', {
      name: 'check_text',
      arguments: { text: '   ', language: 'en-US' },
    });

    expect(response.result?.isError).toBe(true);
    expect(JSON.stringify(response.result?.content)).toContain('text must not be empty');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an error result when LanguageTool is unreachable', async () => {
    const session = await connect(vi.fn<FetchLike>().mockRejectedValue(connectionRefused()));
    close = session.close;
    const response = await session.request('tools/call', {
      name: 'check_text',
      arguments: { text: 'Hello', language: 'en-US' },
    });

    expect(response.result?.isError).toBe(true);
    const [content] = response.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content!.text).error.code).toBe('UNREACHABLE');
  });

  it('reports an offline server through health_check without failing', async () => {
    const session = await connect(vi.fn<FetchLike>().mockRejectedValue(connectionRefused()));
    close = session.close;
    const response = await session.request('tools/call', { name: 'health_check', arguments: {} });

    expect(response.result?.isError).toBeFalsy();
    expect(response.result?.structuredContent).toMatchObject({ status: 'unavailable', reachable: false });
  });
});

describe('unexpected exceptions', () => {
  it('does not let a tool handler leak an exception message', async () => {
    const secret = 'UNPUBLISHED-MANUSCRIPT-SENTENCE';
    const client = createClient(routeFetch({}));
    client.healthcheck = () => Promise.reject(new Error(secret));
    const session = await connect(routeFetch({}), client);
    close = session.close;
    const response = await session.request('tools/call', { name: 'health_check', arguments: {} });

    expect(response.result?.isError).toBe(true);
    expect(JSON.stringify(response)).not.toContain(secret);
  });
});

describe('stdio hygiene', () => {
  it('never writes to stdout from the source code', async () => {
    const sourceDir = new URL('../src/', import.meta.url).pathname;
    const files = (await readdir(sourceDir, { recursive: true })).filter((file) => file.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(join(sourceDir, file), 'utf8');
      expect(source, file).not.toMatch(/console\.(log|info|debug|warn|error)|process\.stdout/);
    }
  });
});
