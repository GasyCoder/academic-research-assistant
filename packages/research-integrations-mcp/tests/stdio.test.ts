import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const directory = dirname(dirname(fileURLToPath(import.meta.url)));
beforeAll(() => {
  const require = createRequire(import.meta.url), compiler = require('typescript/package.json') as { bin: { tsc: string } };
  execFileSync(process.execPath,[join(dirname(require.resolve('typescript/package.json')),compiler.bin.tsc),'-p','tsconfig.json'],{ cwd: directory,stdio: 'pipe' });
},30_000);
describe.each(['2025-11-25','2026-07-28'] as const)('production stdio through official client, protocol %s', revision => {
  let client: Client, transport: StdioClientTransport, stderr = '', stdout = '';
  const errors: Error[] = [];
  beforeAll(async () => {
    transport = new StdioClientTransport({ command: process.execPath,args: [join(directory,'dist/index.js')],
      env: { PATH: process.env.PATH!,ARA_ZOTERO_API_KEY: 'synthetic-zotero-secret',ARA_OPENALEX_API_KEY: 'synthetic-openalex-secret' },stderr: 'pipe' });
    transport.stderr?.on('data',(chunk: Buffer) => { stderr += chunk.toString(); });
    const start = transport.start.bind(transport);
    transport.start = async () => {
      const error = transport.onerror;
      transport.onerror = e => { errors.push(e);error?.(e); };
      await start();
      const child = (transport as unknown as { _process: { stdout: NodeJS.ReadableStream } })._process;
      child.stdout.on('data',(chunk: Buffer) => { stdout += chunk.toString(); });
    };
    client = new Client({ name: 'synthetic-integration-test',version: '0' },{
      versionNegotiation: { mode: revision === '2025-11-25' ? 'legacy' : { pin: revision } },
    });
    await client.connect(transport);
  },15_000);
  afterAll(async () => { await client?.close(); });
  it('negotiates its protocol and exposes seven separate read-only tools with schemas', async () => {
    expect(client.getNegotiatedProtocolVersion()).toBe(revision);
    const result = await client.listTools();
    expect(result.tools.map(t => t.name).sort()).toEqual(['crossref_lookup_doi','crossref_search_works','openalex_lookup_work',
      'openalex_search_works','vale_check','zotero_get_item','zotero_search_items']);
    for (const tool of result.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);expect(tool.outputSchema).toBeDefined();
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
  });
  it('refuses network requests without consent and leaks no environment values', async () => {
    const result = await client.callTool({ name: 'crossref_lookup_doi',arguments: { doi: '10.5555/synthetic' } });
    expect(result.structuredContent).toMatchObject({ status: 'verification_not_performed',records: [],error: { code: 'NETWORK_CONSENT_REQUIRED' } });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-zotero-secret|synthetic-openalex-secret/u);
  });
  it.each([
    { doi: '10.5555/synthetic', baseUrl: 'http://169.254.169.254/private' },
    { doi: '10.5555/synthetic', networkConsent: 'SYNTHETIC_PRIVATE_MARKER' },
    { doi: 'SYNTHETIC_PRIVATE_MARKER'.repeat(30) },
  ])('rejects invalid input without echoing values or stopping the server', async (args) => {
    const result = await client.callTool({ name: 'crossref_lookup_doi', arguments: args });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
    const next = await client.callTool({ name: 'vale_check',arguments: { text: 'Synthetic prose.' } });
    expect(next.structuredContent).toMatchObject({ engine: 'vale',status: 'unavailable',error: { code: 'VALE_UNAVAILABLE' } });
  });
  it('neither sends nor echoes an unrecognized DOI', async () => {
    const result = await client.callTool({ name: 'crossref_lookup_doi', arguments: { doi: 'SYNTHETIC_PRIVATE_MARKER', networkConsent: true } });
    expect(result.structuredContent).toMatchObject({
      status: 'verification_not_performed',
      doiVerification: { syntax: 'not_recognized' },
      error: { code: 'DOI_NOT_RECOGNIZED' },
    });
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
  });
  it('keeps stdout protocol-only, stderr sanitized and exits on client close', async () => {
    const pid = transport.pid!;
    expect(errors).toEqual([]);expect(stdout.length).toBeGreaterThan(0);
    for (const line of stdout.trim().split('\n')) expect(JSON.parse(line).jsonrpc).toBe('2.0');
    expect(stderr).not.toMatch(/synthetic-zotero-secret|synthetic-openalex-secret|SYNTHETIC_PRIVATE_MARKER/u);
    const start = performance.now();await client.close();expect(performance.now()-start).toBeLessThan(1500);
    expect(() => process.kill(pid,0)).toThrow();
  });
});
