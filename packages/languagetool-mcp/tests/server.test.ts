import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MAX_TEXT_LENGTH, type FetchLike, type LanguageToolClient } from '../src/languagetool-client.js';
import { SERVER_NAME, SERVER_VERSION, createServer } from '../src/server.js';
import { MAX_DOCUMENT_LENGTH } from '../src/tools/check-document.js';
import { fakeLanguageToolFetch, tehOffsets } from './fake-languagetool.js';
import { emptyCheckResponse, englishCheckResponse, englishText } from './fixtures/languagetool-responses.js';
import { connectionRefused, createClient, jsonResponse, routeFetch } from './helpers.js';

type JsonRpcResult = { id: number; result?: Record<string, unknown>; error?: { message: string } };

/** Minimal JSON-RPC peer over an in-memory transport, so tests need no MCP client dependency. */
async function connect(fetchImpl: FetchLike, client: LanguageToolClient = createClient(fetchImpl)) {
  const server = createServer(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JsonRpcResult) => void>();
  const notifications: Array<{ method: string; params?: Record<string, unknown> }> = [];
  clientTransport.onmessage = (message) => {
    if (!('id' in message)) {
      notifications.push(message as (typeof notifications)[number]);
      return;
    }
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

  return { init, request, notifications, close: () => server.close() };
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
    // One version for the repository, the package and the server (docs/releasing.md).
    const rootPackageJson = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(rootPackageJson.version).toBe(packageJson.version);

    const session = await connect(routeFetch({}));
    close = session.close;
    expect(session.init.result?.serverInfo).toEqual({ name: SERVER_NAME, version: SERVER_VERSION });
  });

  it('exposes exactly the four LanguageTool tools', async () => {
    const session = await connect(routeFetch({}));
    close = session.close;
    const response = await session.request('tools/list');
    const tools = response.result?.tools as Array<{ name: string; outputSchema?: unknown; inputSchema: unknown }>;

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_document',
      'check_text',
      'get_supported_languages',
      'health_check',
    ]);
    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
    }
    for (const name of ['check_text', 'check_document']) {
      expect(tools.find((tool) => tool.name === name)!.inputSchema).toMatchObject({
        required: expect.arrayContaining(['text', 'language']),
      });
    }
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

describe('check_text input length limit over MCP', () => {
  const MARKER = 'UNPUBLISHED-RESULT-7';
  /** A text of exactly `length` UTF-16 code units containing MARKER. */
  const textOfLength = (length: number) => `${MARKER} `.padEnd(length, 'Lorem ipsum dolor sit amet. ');

  it('advertises the limit as maxLength in the check_text input schema', async () => {
    const session = await connect(routeFetch({}));
    close = session.close;
    const response = await session.request('tools/list');
    const tools = response.result?.tools as Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }>;
    const checkText = tools.find((tool) => tool.name === 'check_text')!;

    expect(checkText.inputSchema.properties.text).toMatchObject({ type: 'string', maxLength: DEFAULT_MAX_TEXT_LENGTH });
  });

  it('checks a text of exactly the limit unchanged', async () => {
    const text = textOfLength(DEFAULT_MAX_TEXT_LENGTH);
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(emptyCheckResponse) });
    const session = await connect(fetchMock);
    close = session.close;
    const response = await session.request('tools/call', { name: 'check_text', arguments: { text, language: 'en-US' } });

    expect(response.result?.isError).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![1].body as URLSearchParams).get('text')).toBe(text);
  });

  it('rejects a longer text with a structured TEXT_TOO_LONG error, without contacting LanguageTool', async () => {
    const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse(emptyCheckResponse) });
    const session = await connect(fetchMock);
    close = session.close;
    const response = await session.request('tools/call', {
      name: 'check_text',
      arguments: { text: textOfLength(DEFAULT_MAX_TEXT_LENGTH + 1), language: 'en-US' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.result?.isError).toBe(true);
    const [content] = response.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content!.text).error).toMatchObject({
      code: 'TEXT_TOO_LONG',
      endpoint: '/v2/check',
      httpStatus: null,
    });
    expect(JSON.stringify(response)).not.toContain(MARKER);
  });
});

describe('check_document over MCP', () => {
  /** Paragraphs long enough for several 50,000-unit requests, with a "teh" in some of them. */
  const longDocument = () =>
    Array.from({ length: 1_400 }, (_, index) =>
      index % 300 === 7 ? `Paragraph ${index}: 😀 teh issue.` : `Paragraph ${index} describes the method in detail.`,
    ).join('\n\n');

  it('advertises the document limit as maxLength', async () => {
    const session = await connect(routeFetch({}));
    close = session.close;
    const response = await session.request('tools/list');
    const tools = response.result?.tools as Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }>;

    expect(tools.find((tool) => tool.name === 'check_document')!.inputSchema.properties.text).toMatchObject({
      type: 'string',
      maxLength: MAX_DOCUMENT_LENGTH,
    });
  });

  it('returns issues at document offsets and reports progress per chunk', async () => {
    const text = longDocument();
    const fake = fakeLanguageToolFetch();
    const session = await connect(fake.fetch);
    close = session.close;
    const response = await session.request('tools/call', {
      name: 'check_document',
      arguments: { text, language: 'en-US' },
      _meta: { progressToken: 'doc-1' },
    });

    expect(response.result?.isError).toBeFalsy();
    const result = response.result?.structuredContent as { chunkCount: number; complete: boolean; issues: Array<{ offset: number }> };
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.complete).toBe(true);
    expect(result.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    const progress = session.notifications.filter((notification) => notification.method === 'notifications/progress');
    expect(progress.map((notification) => notification.params)).toEqual(
      Array.from({ length: result.chunkCount }, (_, index) => ({
        progressToken: 'doc-1',
        progress: index + 1,
        total: result.chunkCount,
      })),
    );
  });

  it('rejects a document above the limit with TEXT_TOO_LONG, then keeps serving', async () => {
    const fake = fakeLanguageToolFetch();
    const session = await connect(fake.fetch);
    close = session.close;
    const tooLong = await session.request('tools/call', {
      name: 'check_document',
      arguments: { text: 'word '.repeat(MAX_DOCUMENT_LENGTH / 5 + 1), language: 'en-US' },
    });

    expect(tooLong.result?.isError).toBe(true);
    const [content] = tooLong.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content!.text).error).toMatchObject({ code: 'TEXT_TOO_LONG', httpStatus: null });
    expect(fake.state.requests).toHaveLength(0);

    const next = await session.request('tools/call', { name: 'check_document', arguments: { text: 'A teh.', language: 'en-US' } });
    expect(next.result?.structuredContent).toMatchObject({ issueCount: 1, complete: true });
  });
});

describe('get_supported_languages over MCP', () => {
  it('returns unusual upstream language codes as data', async () => {
    const languages = [
      { name: 'A', code: '__proto__', longCode: '__proto__' },
      { name: 'B', code: 'constructor', longCode: 'constructor-X' },
    ];
    const session = await connect(routeFetch({ 'GET /v2/languages': () => jsonResponse(languages) }));
    close = session.close;
    const response = await session.request('tools/call', { name: 'get_supported_languages', arguments: {} });

    expect(response.result?.isError).toBeFalsy();
    const [content] = response.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content!.text).variantsByCode).toEqual(
      JSON.parse('{"__proto__": ["__proto__"], "constructor": ["constructor-X"]}'),
    );
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
