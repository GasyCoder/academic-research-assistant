/*
 * End-to-end test of the production entry point: builds the package, spawns
 * `node dist/index.js` against a synthetic LanguageTool server and talks MCP over
 * stdio, first with the SDK's own stdio framing (ReadBuffer / serializeMessage) in
 * the 2025 handshake mode, then with the official v2 client pinned to the
 * 2026-07-28 protocol revision.
 */
import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  type JSONRPCMessage,
  LATEST_PROTOCOL_VERSION,
  ReadBuffer,
  serializeMessage,
} from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_MAX_TEXT_LENGTH } from '../src/languagetool-client.js';
import { MAX_DOCUMENT_LENGTH } from '../src/tools/check-document.js';
import { MAX_MCP_RESULT_BYTES } from '../src/tools/results.js';
import { fakeCheckResponse, tehOffsets } from './fake-languagetool.js';
import { emptyCheckResponse, infoResponse, languagesResponse } from './fixtures/languagetool-responses.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entryPoint = join(packageDir, 'dist', 'index.js');

const MANUSCRIPT = 'Confidential draft: protein KX-9 binds receptor R7 with nanomolar affinity.';
const MARKER = 'KX-9';
const BUDGET_MESSAGES = [
  'm'.repeat(3_000),
  'é漢😀'.repeat(600),
  '"\\\n\u0000\u2028\u2029\ud800'.repeat(200),
];

type Response = { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } };
type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }>; structuredContent?: unknown };

function buildPackage(): void {
  const require = createRequire(import.meta.url);
  const typescriptDir = dirname(require.resolve('typescript/package.json'));
  const tscBin = (require('typescript/package.json') as { bin: { tsc: string } }).bin.tsc;
  execFileSync(process.execPath, [join(typescriptDir, tscBin), '-p', join(packageDir, 'tsconfig.json')], {
    stdio: 'pipe',
  });
}

/**
 * A document of `paragraphs` paragraphs; every 50th has a "teh" after an emoji, and `inserts`
 * replace given paragraphs.
 */
function longDocument(paragraphs: number, inserts: Record<number, string> = {}): string {
  return Array.from(
    { length: paragraphs },
    (_, index) =>
      inserts[index] ??
      (index % 50 === 7 ? `Paragraph ${index}: 😀 teh issue.` : `Paragraph ${index} describes the method in detail.`),
  ).join('\n\n');
}

/**
 * Synthetic LanguageTool (see fakeCheckResponse: every "teh" is an issue). It echoes manuscripts
 * containing MARKER in a 500 body, and inflates issue messages of texts containing BIGISSUES.
 */
function startFakeLanguageTool(): Promise<TestHttpServer> {
  return startHttpServer((request, response) => {
    const route = `${request.method} ${request.url}`;
    const json = (body: unknown) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (route === 'GET /v2/healthcheck') {
      response.end('OK');
    } else if (route === 'GET /v2/info') {
      json(infoResponse);
    } else if (route === 'GET /v2/languages') {
      json(languagesResponse);
    } else if (route === 'POST /v2/check') {
      const text = new URLSearchParams(request.body).get('text') ?? '';
      if (text.includes(MARKER)) {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end(`Internal error while checking: ${text}`);
      } else if (text.includes('BADJSON')) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(`invalid JSON ${MANUSCRIPT}`);
      } else if (text === 'x'.repeat(DEFAULT_MAX_TEXT_LENGTH)) {
        const body = {
          ...emptyCheckResponse,
          matches: Array.from({ length: 22_000 }, (_, index) => ({
            message: MANUSCRIPT,
            offset: index * 2,
            length: 1,
            replacements: [{ value: 'a' }],
            rule: { id: 'SPELLING' },
          })),
        };
        expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(DEFAULT_MAX_RESPONSE_BYTES);
        json(body);
      } else {
        const language = new URLSearchParams(request.body).get('language') ?? 'en-US';
        const body = fakeCheckResponse(text, language, text.includes('BIGISSUES') ? { messageLength: 3_000 } : {});
        const budgetCase = /BUDGET([0-2])/.exec(text);
        if (budgetCase) {
          for (const match of body.matches) match.message = BUDGET_MESSAGES[Number(budgetCase[1])]!;
          expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(DEFAULT_MAX_RESPONSE_BYTES);
        }
        json(body);
      }
    } else {
      response.writeHead(404);
      response.end();
    }
  });
}

class StdioSession {
  stdout = '';
  stderr = '';
  readonly protocolErrors: unknown[] = [];
  readonly exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  private readonly readBuffer = new ReadBuffer();
  private readonly pending = new Map<number, (response: Response) => void>();
  private nextId = 1;

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', (chunk: Buffer) => {
      this.stdout += chunk.toString('utf8');
      this.readBuffer.append(chunk);
      try {
        for (let message = this.readBuffer.readMessage(); message; message = this.readBuffer.readMessage()) {
          const response = message as unknown as Response;
          this.pending.get(response.id)?.(response);
        }
      } catch (error) {
        this.protocolErrors.push(error);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString('utf8');
    });
    this.exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  }

  request(method: string, params?: Record<string, unknown>): Promise<Response> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no response to ${method}`)), 5000);
      this.pending.set(id, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      this.send({ jsonrpc: '2.0', id, method, ...(params && { params }) } as JSONRPCMessage);
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const response = await this.request('tools/call', { name, arguments: args });
    expect(response.error).toBeUndefined();
    return response.result as unknown as ToolResult;
  }

  send(message: JSONRPCMessage): void {
    this.child.stdin.write(serializeMessage(message));
  }

  closeStdin(): void {
    this.child.stdin.end();
  }

  kill(): void {
    this.child.kill('SIGKILL');
  }
}

beforeAll(() => buildPackage(), 60_000);

describe('production stdio server (dist/index.js)', () => {
  let languageTool: TestHttpServer;
  let session: StdioSession;

  beforeAll(async () => {
    languageTool = await startFakeLanguageTool();
    const child = spawn(process.execPath, [entryPoint], {
      env: { ...process.env, LANGUAGETOOL_BASE_URL: languageTool.url, LANGUAGETOOL_TIMEOUT_MS: '3000' },
      stdio: 'pipe',
    });
    session = new StdioSession(child);
  }, 60_000);

  afterAll(async () => {
    session?.kill();
    await languageTool?.close();
  });

  it('completes the MCP initialize handshake', async () => {
    const response = await session.request('initialize', {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'stdio-test', version: '0' },
    });
    expect(response.result).toMatchObject({
      protocolVersion: LATEST_PROTOCOL_VERSION,
      serverInfo: { name: 'languagetool-mcp' },
      capabilities: { tools: {} },
    });
    session.send({ jsonrpc: '2.0', method: 'notifications/initialized' } as JSONRPCMessage);
  });

  it('exposes exactly the four tools', async () => {
    const response = await session.request('tools/list');
    const names = (response.result?.tools as Array<{ name: string }>).map((tool) => tool.name).sort();
    expect(names).toEqual(['check_document', 'check_text', 'get_supported_languages', 'health_check']);
  });

  it('reports a healthy LanguageTool', async () => {
    const result = await session.callTool('health_check', {});
    expect(result.structuredContent).toMatchObject({ status: 'ok', reachable: true, baseUrl: languageTool.url });
  });

  it('lists languages', async () => {
    const result = await session.callTool('get_supported_languages', {});
    expect(result.structuredContent).toMatchObject({ count: languagesResponse.length });
  });

  it('checks text', async () => {
    const result = await session.callTool('check_text', { text: 'This sentence is fine.', language: 'en-US' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ issueCount: 0 });
  });

  it.each([
    ['empty text', { text: '   ', language: 'en-US' }],
    ['missing language', { text: MANUSCRIPT }],
    ['text of the wrong type', { text: [MANUSCRIPT], language: 'en-US' }],
    ['invalid language code', { text: MANUSCRIPT, language: `${MARKER} ${MANUSCRIPT}` }],
  ])('rejects invalid input: %s', async (_case, args) => {
    const languageToolCalls = languageTool.requests.length;
    const result = await session.callTool('check_text', args);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Input validation error');
    expect(languageTool.requests.length).toBe(languageToolCalls);
  });

  it('returns a structured error without the manuscript when LanguageTool echoes it', async () => {
    const result = await session.callTool('check_text', { text: MANUSCRIPT, language: 'en-US' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]!.text)).toEqual({
      error: {
        code: 'HTTP_ERROR',
        message: 'LanguageTool answered HTTP 500 (server error)',
        endpoint: '/v2/check',
        httpStatus: 500,
      },
    });
  });

  it('rejects a text above the length limit with TEXT_TOO_LONG, without contacting LanguageTool', async () => {
    const languageToolCalls = languageTool.requests.length;
    const text = `${MANUSCRIPT} `.padEnd(DEFAULT_MAX_TEXT_LENGTH + 1, 'Lorem ipsum dolor sit amet. ');
    const result = await session.callTool('check_text', { text, language: 'en-US' });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]!.text).error).toMatchObject({ code: 'TEXT_TOO_LONG', httpStatus: null });
    expect(languageTool.requests.length).toBe(languageToolCalls);
  });

  it('returns a small error for oversized MCP output and keeps serving the connection', async () => {
    const calls = languageTool.requests.length;
    const result = await session.callTool('check_text', { text: 'x'.repeat(DEFAULT_MAX_TEXT_LENGTH), language: 'en-US' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.parse(result.content[0]!.text).error).toMatchObject({ code: 'INVALID_RESPONSE', endpoint: null, httpStatus: null });
    expect(result.content[0]!.text).toContain('MCP result limit');
    expect(languageTool.requests.length).toBe(calls + 1);
    expect((await session.callTool('health_check', {})).structuredContent).toMatchObject({ status: 'ok' });
    expect((await session.callTool('check_text', { text: 'A short sentence.', language: 'en-US' })).isError).toBeFalsy();
  });

  it('checks a long document with offsets in the whole document', async () => {
    const calls = languageTool.requests.length;
    const text = longDocument(1_800);
    expect(text.length).toBeGreaterThan(DEFAULT_MAX_TEXT_LENGTH);
    const result = await session.callTool('check_document', { text, language: 'en-US' });

    expect(result.isError).toBeFalsy();
    const content = result.structuredContent as { chunkCount: number; complete: boolean; issues: Array<{ offset: number }> };
    expect(content.complete).toBe(true);
    expect(content.chunkCount).toBeGreaterThanOrEqual(2);
    expect(content.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    expect(JSON.parse(result.content[0]!.text)).toEqual(content);
    expect(languageTool.requests.length).toBe(calls + content.chunkCount);
  });

  it('rejects a document above its limit with TEXT_TOO_LONG, without contacting LanguageTool', async () => {
    const calls = languageTool.requests.length;
    const text = `${MANUSCRIPT}\n\n${longDocument(4_000)}`.slice(0, MAX_DOCUMENT_LENGTH + 1);
    const result = await session.callTool('check_document', { text, language: 'en-US' });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]!.text).error).toMatchObject({ code: 'TEXT_TOO_LONG', httpStatus: null });
    expect(languageTool.requests.length).toBe(calls);
  });

  it('returns a partial document result without the content of the failed chunk', async () => {
    // The chunk holding MARKER gets an HTTP 500 echoing it; the remaining chunks are skipped.
    const text = longDocument(2_100, { 1_200: MANUSCRIPT });
    const result = await session.callTool('check_document', { text, language: 'en-US' });

    expect(result.isError).toBeFalsy();
    const content = result.structuredContent as { complete: boolean; failedRanges: Array<{ code: string; start: number; end: number }> };
    expect(content.complete).toBe(false);
    expect(content.failedRanges[0]).toMatchObject({ code: 'HTTP_ERROR' });
    expect(content.failedRanges.length).toBeGreaterThan(1);
    expect(content.failedRanges.slice(1).every((range) => range.code === 'SKIPPED')).toBe(true);
    expect(content.failedRanges[0]!.start).toBeLessThan(text.indexOf(MARKER));
    expect(JSON.stringify(result)).not.toContain(MARKER);
  });

  it('bounds a large document result and keeps serving the connection', async () => {
    const text = 'BIGISSUES. A sentence with one teh in it, and more words. '.repeat(1_700);
    const response = await session.request('tools/call', { name: 'check_document', arguments: { text, language: 'en-US' } });
    const result = response.result as unknown as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ truncated: true, complete: false });
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(MAX_MCP_RESULT_BYTES);
    expect((await session.callTool('health_check', {})).structuredContent).toMatchObject({ status: 'ok' });
    expect((await session.callTool('check_document', { text: 'A teh.', language: 'en-US' })).structuredContent).toMatchObject({
      issueCount: 1,
    });
  });

  it('writes only MCP messages to stdout and never the manuscript to stdout or stderr', () => {
    expect(session.protocolErrors).toEqual([]);
    const lines = session.stdout.split('\n').filter((line) => line !== '');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' });
    }
    expect(session.stdout).not.toContain(MARKER);
    expect(session.stderr).not.toContain(MARKER);
    for (const line of session.stderr.split('\n').filter((entry) => entry !== '')) {
      expect(line).toMatch(/^\[languagetool-mcp\] /);
    }
  });

  it('exits cleanly when stdin is closed', async () => {
    session.closeStdin();
    const exit = await Promise.race([
      session.exited,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5000)),
    ]);
    expect(exit).toEqual({ code: 0, signal: null });
  });
});

describe.each(['2025-11-25', '2026-07-28'] as const)('official MCP client on protocol revision %s (dist/index.js)', (revision) => {
  let languageTool: TestHttpServer;
  let client: Client;
  let transport: StdioClientTransport;
  let stderr = '';
  let stdout = '';
  const wireMessages: Response[] = [];
  const transportErrors: Error[] = [];

  beforeAll(async () => {
    languageTool = await startFakeLanguageTool();
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [entryPoint],
      env: { ...process.env, LANGUAGETOOL_BASE_URL: languageTool.url, LANGUAGETOOL_TIMEOUT_MS: '3000' },
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    const start = transport.start.bind(transport);
    transport.start = async () => {
      const receive = transport.onmessage;
      transport.onmessage = (message) => {
        // Observe the SDK's received wire envelope before client normalization.
        wireMessages.push(message as unknown as Response);
        receive?.(message);
      };
      // JSON lines that are not MCP messages surface here; the SDK skips non-JSON lines silently.
      const fail = transport.onerror;
      transport.onerror = (error) => {
        transportErrors.push(error);
        fail?.(error);
      };
      await start();
      // Raw stdout, to catch output the SDK would skip. The field is private to the pinned SDK version.
      const child = (transport as unknown as { _process?: { stdout?: NodeJS.ReadableStream } })._process;
      expect(child?.stdout).toBeDefined();
      child!.stdout!.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
    };
    client = new Client({ name: 'audit-test', version: '0' }, {
      versionNegotiation: { mode: revision === '2025-11-25' ? 'legacy' : { pin: revision } },
    });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    await languageTool?.close();
  });

  it('negotiates the requested revision and lists the four tools', async () => {
    expect(client.getNegotiatedProtocolVersion()).toBe(revision);
    expect(client.getProtocolEra()).toBe(revision === '2025-11-25' ? 'legacy' : 'modern');
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_document',
      'check_text',
      'get_supported_languages',
      'health_check',
    ]);
  });

  it('checks a long document and reports progress for each chunk', async () => {
    const text = longDocument(1_800);
    const progress: Array<{ progress: number; total?: number }> = [];
    const result = await client.callTool(
      { name: 'check_document', arguments: { text, language: 'en-US' } },
      { onprogress: (update) => progress.push(update), resetTimeoutOnProgress: true },
    );

    expect(result.isError).toBeFalsy();
    const content = result.structuredContent as { chunkCount: number; complete: boolean; issues: Array<{ offset: number }> };
    expect(content.complete).toBe(true);
    expect(content.issues.map((issue) => issue.offset)).toEqual(tehOffsets(text));
    expect(progress.map((update) => [update.progress, update.total])).toEqual(
      Array.from({ length: content.chunkCount }, (_, index) => [index + 1, content.chunkCount]),
    );
  });

  it('returns TEXT_TOO_LONG for an oversized document, then keeps serving', async () => {
    const calls = languageTool.requests.length;
    const text = `${MANUSCRIPT}\n\n${longDocument(4_000)}`.slice(0, MAX_DOCUMENT_LENGTH + 1);
    const tooLong = await client.callTool({ name: 'check_document', arguments: { text, language: 'en-US' } });

    expect(tooLong.isError).toBe(true);
    const [content] = tooLong.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content!.text).error).toMatchObject({ code: 'TEXT_TOO_LONG' });
    expect(languageTool.requests.length).toBe(calls);

    const next = await client.callTool({ name: 'check_text', arguments: { text: 'A teh.', language: 'en-US' } });
    expect(next.structuredContent).toMatchObject({ issueCount: 1 });
  });

  it('keeps the manuscript out of results and stderr when a chunk fails', async () => {
    const result = await client.callTool({
      name: 'check_document',
      arguments: { text: longDocument(2_100, { 1_200: MANUSCRIPT }), language: 'en-US' },
    });

    expect(result.structuredContent).toMatchObject({ complete: false });
    const data = result.structuredContent as { failedRanges: Array<{ code: string }> };
    expect(data.failedRanges.map((range) => range.code)).toEqual(['HTTP_ERROR', 'SKIPPED']);
    expect(JSON.stringify(result)).not.toContain(MARKER);
    expect(stderr).not.toContain(MARKER);
    expect((await client.callTool({ name: 'check_document', arguments: { text: 'A teh.', language: 'en-US' } })).structuredContent)
      .toMatchObject({ complete: true, issueCount: 1 });
  });

  it('stops an HTTP server returning invalid JSON after two requests and keeps serving', async () => {
    const calls = languageTool.requests.length;
    const result = await client.callTool({
      name: 'check_document', arguments: { text: 'BADJSON '.repeat(12_000), language: 'en-US' },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text: string }>;
    expect(JSON.parse(content[0]!.text).error).toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(languageTool.requests.length - calls).toBe(2);
    expect(JSON.stringify(result)).not.toContain(MARKER);
    expect(stderr).not.toContain(MARKER);
    expect((await client.callTool({ name: 'check_document', arguments: { text: 'A teh.', language: 'en-US' } })).structuredContent)
      .toMatchObject({ complete: true, issueCount: 1 });
  });

  it.each(BUDGET_MESSAGES.map((_, index) => index))('bounds actual SDK output for JSON/UTF-8 case %i and keeps serving', async (index) => {
    const calls = languageTool.requests.length;
    const result = await client.callTool({
      name: 'check_document',
      arguments: { text: `BUDGET${index}. ${'A sentence with one teh in it, and more words. '.repeat(2_100)}`, language: 'en-US' },
    });
    const data = result.structuredContent as {
      truncated: boolean; truncatedAt: number; issueCount: number; processedChunkCount: number;
      issues: Array<{ message: string; offset: number }>;
    };
    expect(data).toMatchObject({ truncated: true, complete: false });
    expect(data.issues.every((issue) => issue.message === BUDGET_MESSAGES[index])).toBe(true);
    expect(data.issueCount).toBe(data.issues.length);
    expect(data.issues.at(-1)!.offset).toBeLessThan(data.truncatedAt);
    expect(languageTool.requests.length - calls).toBe(data.processedChunkCount);
    const wire = wireMessages.at(-1)!;
    expect(wire.result?.structuredContent).toEqual(data);
    const content = wire.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content[0]!.text)).toEqual(data);
    const issueCost = data.issues.reduce((sum, issue) => {
      const json = JSON.stringify(issue);
      return sum + Buffer.byteLength(json) + Buffer.byteLength(JSON.stringify(json));
    }, 0);
    expect(issueCost).toBeLessThanOrEqual(MAX_MCP_RESULT_BYTES / 2);
    // Object-shaped results are unchanged by both SDK codecs; serialize the received
    // envelope with the same official serializer used by the server's stdio writer.
    const bytes = Buffer.byteLength(serializeMessage(wire as unknown as JSONRPCMessage));
    expect(bytes).toBeLessThan(MAX_MCP_RESULT_BYTES);
    expect(bytes).toBeLessThan(issueCost + 10_000);
    expect((await client.callTool({ name: 'check_document', arguments: { text: 'A teh.', language: 'en-US' } })).structuredContent)
      .toMatchObject({ complete: true, truncated: false, issueCount: 1 });
  });

  it('writes only MCP messages to stdout and exits on its own when the client closes', async () => {
    const pid = transport.pid!;
    expect(transportErrors).toEqual([]);
    const lines = stdout.split('\n').filter((line) => line !== '');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' });
    }
    expect(stdout).not.toContain(MARKER);
    const start = performance.now();
    await client.close();
    // close() ends stdin, then waits up to 2 s for the process before sending SIGTERM.
    expect(performance.now() - start).toBeLessThan(1_500);
    expect(() => process.kill(pid, 0)).toThrow();
    expect(stderr).not.toContain(MARKER);
  });
});
