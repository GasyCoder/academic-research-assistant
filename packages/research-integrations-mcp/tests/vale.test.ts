/*
 * The Vale adapter against fake executables: no system Vale is needed. Each fake is a small Node
 * script that checks how it was invoked and prints a canned JSON report.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LIMITS } from '../src/contracts.js';
import { createIntegrations } from '../src/service.js';
import { valeResultSchema } from '../src/vale.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const diagnostic = { Check: 'Synthetic.Rule', Message: 'Prefer a specific term.', Severity: 'warning', Match: 'very', Line: 1, Span: [1, 4] };

/** Reads stdin into `text`, then runs `body`. */
const withStdin = (body: string) => `let text='';process.stdin.on('data',x=>text+=x);process.stdin.on('end',()=>{${body}});`;

async function fakeVale(script: string, env: NodeJS.ProcessEnv = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ara-vale-test-'));
  directories.push(directory);
  const executable = join(directory, 'fake-vale.cjs');
  const config = join(directory, '.vale.ini');
  await writeFile(executable, `#!/usr/bin/env node\n${script}`, { mode: 0o700 });
  await writeFile(config, 'MinAlertLevel = suggestion\n');
  const service = createIntegrations({
    ARA_VALE_PATH: executable,
    ARA_VALE_CONFIG: config,
    ARA_INTEGRATIONS_TIMEOUT_MS: '2000',
    ARA_ZOTERO_API_KEY: 'synthetic-zotero-secret',
    ARA_OPENALEX_API_KEY: 'synthetic-openalex-secret',
    ...env,
  });
  return { service, directory, executable, config };
}

describe('optional Vale adapter', () => {
  it('M: reports VALE_UNAVAILABLE without installing or discovering a binary', async () => {
    const unconfigured = await createIntegrations({}).valeCheck({ text: 'Some prose.' });
    expect(unconfigured).toMatchObject({ engine: 'vale', status: 'unavailable', diagnostics: [], error: { code: 'VALE_UNAVAILABLE' } });
    expect(valeResultSchema.safeParse(unconfigured).success).toBe(true);

    const { directory, config, executable } = await fakeVale('process.exit(3);');
    const missingBinary = createIntegrations({ ARA_VALE_PATH: join(directory, 'missing'), ARA_VALE_CONFIG: config });
    expect((await missingBinary.valeCheck({ text: 'Some prose.' })).error?.code).toBe('VALE_UNAVAILABLE');
    const missingConfig = createIntegrations({ ARA_VALE_PATH: executable, ARA_VALE_CONFIG: join(directory, 'missing.ini') });
    expect((await missingConfig.valeCheck({ text: 'Some prose.' })).error?.code).toBe('VALE_UNAVAILABLE');
    const directoryAsBinary = createIntegrations({ ARA_VALE_PATH: directory, ARA_VALE_CONFIG: config });
    expect((await directoryAsBinary.valeCheck({ text: 'Some prose.' })).error?.code).toBe('VALE_UNAVAILABLE');
  });

  it('N: sends text on stdin with fixed arguments and returns engine-native diagnostics only', async () => {
    const { service, config } = await fakeVale(
      withStdin(`
        const expected=['--config',${JSON.stringify('CONFIG')},'--no-global','--output=JSON','--no-exit','--ext=.txt'];
        if(text!=='very clear prose'||JSON.stringify(process.argv.slice(2))!==JSON.stringify(expected))process.exit(2);
        process.stdout.write(JSON.stringify({'stdin.txt':[${JSON.stringify({ ...diagnostic, Action: { Name: 'replace', Params: ['specific'] }, Link: 'https://example.invalid/rule' })}]}));`).replace(
        '"CONFIG"',
        'process.argv[3]',
      ),
    );
    const result = await service.valeCheck({ text: 'very clear prose' });
    expect(valeResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ status: 'completed', sourceKind: 'local_tool_result', coordinateSystem: 'vale_line_span', truncated: false });
    expect(result.diagnostics).toEqual([diagnostic]);
    expect(JSON.stringify(result)).not.toMatch(/stdin\.txt|Action|replace|example\.invalid/u);
    expect(JSON.stringify(result)).not.toContain(config);
  });

  it('reads Markdown with the Markdown parser when asked', async () => {
    const { service } = await fakeVale(withStdin(`if(!process.argv.includes('--ext=.md'))process.exit(2);process.stdout.write('{}');`));
    expect((await service.valeCheck({ text: '# Title\n\nProse.', format: 'markdown' })).status).toBe('completed');
  });

  it('O: never interprets shell syntax, passes no prose as argv and hides provider credentials', async () => {
    const prose = '$(touch injected); `echo injected` | rm -rf / ; --config=/untrusted/file \u0000';
    const { service, directory } = await fakeVale(
      withStdin(`
        if(text!==${JSON.stringify(prose)}||process.argv.some(a=>a.includes('injected')||a.includes('untrusted')))process.exit(2);
        if(Object.keys(process.env).some(k=>k.startsWith('ARA_'))||JSON.stringify(process.env).includes('synthetic-'))process.exit(2);
        process.stdout.write('{}');`),
    );
    expect((await service.valeCheck({ text: prose })).status).toBe('completed');
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(directory)).toEqual(expect.not.arrayContaining(['injected']));
  });

  it('times out and kills the child', async () => {
    const { service } = await fakeVale('setInterval(()=>{},1000);', { ARA_INTEGRATIONS_TIMEOUT_MS: '150' });
    expect((await service.valeCheck({ text: 'Some prose.' })).error?.code).toBe('TIMEOUT');
  });

  it.each(['stdout', 'stderr'] as const)('caps %s without echoing it', async (stream) => {
    const { service } = await fakeVale(`process.${stream}.write('S'.repeat(${LIMITS.processBytes + 1}));`);
    const result = await service.valeCheck({ text: 'Some prose.' });
    expect(result.error?.code).toBe('RESPONSE_TOO_LARGE');
    expect(JSON.stringify(result).length).toBeLessThan(1000);
  });

  it.each(['not JSON', '{"stdin.txt":[{"Message":"SYNTHETIC_PRIVATE_MARKER"}]}', '{"stdin.txt":[{"Check":"R","Message":"m","Severity":"warning","Line":1,"Span":[5,2]}]}'])(
    'refuses malformed output: %s',
    async (output) => {
      const { service } = await fakeVale(`process.stdout.write(${JSON.stringify(output)});`);
      const result = await service.valeCheck({ text: 'Some prose.' });
      expect(result.error?.code).toBe('INVALID_RESPONSE');
      expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
    },
  );

  it('reports a failed run without forwarding stderr', async () => {
    const { service } = await fakeVale("process.stderr.write('SYNTHETIC_PRIVATE_MARKER /srv/drafts/draft.md');process.exit(2);");
    const result = await service.valeCheck({ text: 'Some prose.' });
    expect(result.error?.code).toBe('VALE_FAILURE');
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE_MARKER|draft\.md/u);
  });

  it('bounds the diagnostic count and says so', async () => {
    const { service } = await fakeVale(`process.stdout.write(JSON.stringify({'stdin.txt':Array.from({length:201},()=>(${JSON.stringify(diagnostic)}))}));`);
    const result = await service.valeCheck({ text: 'Some prose.' });
    expect(result.diagnostics).toHaveLength(LIMITS.diagnostics);
    expect(result.truncated).toBe(true);
  });

  it('redacts a configured secret echoed in a diagnostic message', async () => {
    const { service } = await fakeVale(`process.stdout.write(JSON.stringify({'stdin.txt':[${JSON.stringify({ ...diagnostic, Message: 'Avoid synthetic-zotero-secret' })}]}));`);
    const result = await service.valeCheck({ text: 'Some prose.' });
    expect(result.diagnostics[0]).toMatchObject({ Message: '[REDACTED]', Severity: 'warning' });
  });

  it('validates input before starting any process and accepts no executable or config argument', async () => {
    await expect(createIntegrations({}).valeCheck({ text: 'x'.repeat(LIMITS.valeText + 1) })).rejects.toThrow('Invalid integration input');
    await expect(createIntegrations({}).valeCheck({ text: '   ' })).rejects.toThrow('Invalid integration input');
    await expect(createIntegrations({}).valeCheck({ text: 'Some prose.', config: '/untrusted' })).rejects.toThrow('Invalid integration input');
    await expect(createIntegrations({}).valeCheck({ text: 'Some prose.', format: 'docx' })).rejects.toThrow('Invalid integration input');
  });
});
