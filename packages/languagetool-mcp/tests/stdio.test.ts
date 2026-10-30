/*
 * End-to-end test of the production entry point: builds the package, spawns
 * `node dist/index.js` against a synthetic LanguageTool server and talks MCP over
 * stdio, using the SDK's own stdio framing (ReadBuffer / serializeMessage).
 */
import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type JSONRPCMessage,
  LATEST_PROTOCOL_VERSION,
  ReadBuffer,
  serializeMessage,
} from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_MAX_TEXT_LENGTH } from '../src/languagetool-client.js';
import { emptyCheckResponse, infoResponse, languagesResponse } from './fixtures/languagetool-responses.js';
import { type TestHttpServer, startHttpServer } from './http-server.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entryPoint = join(packageDir, 'dist', 'index.js');

const MANUSCRIPT = 'Confidential draft: protein KX-9 binds receptor R7 with nanomolar affinity.';
const MARKER = 'KX-9';

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

/** Synthetic LanguageTool: answers normally, except that it echoes manuscripts containing MARKER in a 500 body. */
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
        json(emptyCheckResponse);
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

describe('production stdio server (dist/index.js)', () => {
  let languageTool: TestHttpServer;
  let session: StdioSession;

  beforeAll(async () => {
    buildPackage();
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

  it('exposes exactly the three tools', async () => {
    const response = await session.request('tools/list');
    const names = (response.result?.tools as Array<{ name: string }>).map((tool) => tool.name).sort();
    expect(names).toEqual(['check_text', 'get_supported_languages', 'health_check']);
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
