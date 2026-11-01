/*
 * Packs the package as npm would publish it, checks the tarball's file list, installs the tarball
 * in a temporary project and drives the installed binary over MCP stdio against a synthetic
 * LanguageTool. Nothing is published. Run with `npm run pack:check`; installing the runtime
 * dependencies needs the npm registry or a warm npm cache.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';

import { fakeCheckResponse } from '../tests/fake-languagetool.js';
import { startHttpServer } from '../tests/http-server.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as { name: string; version: string };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** The built JavaScript, plus what npm always adds. Sources, tests, maps and declarations stay out. */
const ALLOWED = [/^package\.json$/, /^README\.md$/, /^LICEN[CS]E(\.md|\.txt)?$/i, /^dist\/.+\.js$/];
const REQUIRED = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/server.js', 'dist/segmentation.js'];
/** Development dependencies that must not reach an installation. */
const DEV_ONLY = ['@modelcontextprotocol/client', 'tsx', 'typescript', 'vitest'];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`pack:check failed: ${message}`);
  }
}

const work = mkdtempSync(join(tmpdir(), 'languagetool-mcp-pack-'));
try {
  execFileSync(npm, ['run', 'build'], { cwd: packageDir, stdio: 'inherit' });
  const [packed] = JSON.parse(
    execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', work], { cwd: packageDir, encoding: 'utf8' }),
  ) as Array<{ filename: string; files: Array<{ path: string }> }>;
  check(packed, 'npm pack returned no tarball');
  const files = packed.files.map((file) => file.path).sort();
  const unexpected = files.filter((path) => !ALLOWED.some((pattern) => pattern.test(path)));
  check(unexpected.length === 0, `unexpected files in the tarball: ${unexpected.join(', ')}`);
  const missing = REQUIRED.filter((path) => !files.includes(path));
  check(missing.length === 0, `files missing from the tarball: ${missing.join(', ')}`);
  console.log(`${packed.filename}: ${files.length} files, all expected`);

  const project = join(work, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'pack-check', private: true }));
  execFileSync(npm, ['install', '--no-audit', '--no-fund', '--prefer-offline', join(work, packed.filename)], {
    cwd: project,
    stdio: 'inherit',
  });
  for (const name of DEV_ONLY) {
    check(!existsSync(join(project, 'node_modules', name)), `development dependency ${name} was installed`);
  }

  const languageTool = await startHttpServer((request, response) => {
    if (request.url === '/v2/healthcheck') {
      response.end('OK');
      return;
    }
    const params = new URLSearchParams(request.body);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(fakeCheckResponse(params.get('text') ?? '', params.get('language') ?? 'en-US')));
  });
  // The binary npm linked, run directly: this exercises the shebang and the executable bit.
  const transport = new StdioClientTransport({
    command: join(project, 'node_modules', '.bin', 'languagetool-mcp'),
    env: { ...getDefaultEnvironment(), LANGUAGETOOL_BASE_URL: languageTool.url },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'pack-check', version: '0' });
  try {
    await client.connect(transport);
    check(client.getServerVersion()?.version === manifest.version, 'serverInfo.version differs from package.json');
    const { tools } = await client.listTools();
    check(tools.length === 4, `expected 4 tools, got ${tools.map((tool) => tool.name).join(', ')}`);
    const text = await client.callTool({ name: 'check_text', arguments: { text: 'A teh.', language: 'en-US' } });
    check((text.structuredContent as { issueCount?: number }).issueCount === 1, 'check_text did not report the issue');
    // About 77,000 units, so several chunks, with one issue every third paragraph.
    const document = Array.from({ length: 2_400 }, (_, index) =>
      index % 3 === 0 ? `Paragraph ${index} has teh word.` : `Paragraph ${index} has the word.`,
    ).join('\n\n');
    const result = await client.callTool({ name: 'check_document', arguments: { text: document, language: 'en-US' } });
    const content = result.structuredContent as { complete?: boolean; chunkCount?: number; issueCount?: number };
    check(
      content.complete === true && (content.chunkCount ?? 0) > 1 && content.issueCount === 800,
      `check_document returned ${JSON.stringify({ complete: content.complete, chunks: content.chunkCount, issues: content.issueCount })}`,
    );
    console.log(`installed ${manifest.name}@${manifest.version}: binary starts, 4 tools, check_text and check_document work`);
  } finally {
    await client.close();
    await languageTool.close();
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
