/* Explicit Claude CLI smoke test. Uses temporary configs/consumers, never the user's install. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'ara-marketplace-check-'));
const version = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).version;
const id = 'academic-research-assistant@gasycoder-academic-tools';
const expected = ['academic-writing', 'citation-integrity', 'research-profile', 'scientific-review'];
const run = (command, args, cwd, env) => execFileSync(command, args, {
  cwd, env, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
});
try {
  // Current contents of tracked/indexed files only. No ignored local profiles, env or builds.
  // Stage/commit new release files before running this explicit smoke test.
  const source = join(work, 'source'); mkdirSync(source);
  const files = run('git', ['ls-files', '--cached', '-z'], root).split('\0').filter(Boolean);
  for (const file of files) {
    const from = join(root, file);
    assert(lstatSync(from).isFile(), `marketplace smoke needs regular tracked files: ${file}`);
    const to = join(source, file); mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to);
  }
  run('git', ['init', '--initial-branch=main', source], work);
  run('git', ['add', '.'], source);
  const hooks = join(work, 'empty-hooks'); mkdirSync(hooks);
  run('git', ['-c', 'user.name=Marketplace Smoke', '-c', 'user.email=smoke@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${hooks}`, 'commit', '-m', 'Temporary marketplace fixture'], source);

  for (const mode of ['folder', 'git']) {
    const config = join(work, mode, 'config'), consumer = join(work, mode, 'consumer');
    mkdirSync(config, { recursive: true }); mkdirSync(consumer);
    const env = { PATH: process.env.PATH ?? '', CLAUDE_CONFIG_DIR: config,
      DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };
    // Let the actual Git clone use a local repository, without a server or remote access.
    // Claude accepts the HTTPS catalog identifier; Git alone rewrites it to file://.
    const gitSource = 'https://marketplace-smoke.invalid/academic-tools.git';
    if (mode === 'git') Object.assign(env, { GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: `url.${pathToFileURL(source).href}.insteadOf`,
      GIT_CONFIG_VALUE_0: gitSource, GIT_ALLOW_PROTOCOL: 'file' });
    for (const target of [source, join(source, '.claude-plugin/marketplace.json')])
      run('claude', ['plugin', 'validate', target], consumer, env);
    run('claude', ['plugin', 'marketplace', 'add', mode === 'folder' ? source : gitSource,
      '--scope', 'user'], consumer, env);
    run('claude', ['plugin', 'install', id, '--scope', 'user'], consumer, env);
    const installed = JSON.parse(run('claude', ['plugin', 'list', '--json'], consumer, env));
    const entry = installed.find(p => p.id === id);
    assert(entry?.enabled && entry.scope === 'user' && entry.version === version, 'enabled user install/version mismatch');
    const details = run('claude', ['plugin', 'details', 'academic-research-assistant'], consumer, env);
    assert(/Skills \(4\)/u.test(details) && /MCP servers \(0\)/u.test(details) && /Hooks \(0\)/u.test(details));

    // A local /help command initializes the real CLI without model inference or --plugin-dir.
    // Headless help itself is unavailable; the init event proves installed Skill discovery.
    const output = run('claude', ['--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--no-session-persistence', '--print', '--output-format', 'stream-json', '--verbose', '/help'], consumer, env);
    const messages = output.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
    const init = messages.find(m => m.type === 'system' && m.subtype === 'init');
    assert(init, 'CLI startup emitted no init event');
    const names = init.skills.filter(s => s.startsWith('academic-research-assistant:')).sort();
    assert.deepEqual(names, expected.map(s => `academic-research-assistant:${s}`));
    const plugin = init.plugins.find(p => p.name === 'academic-research-assistant');
    assert(plugin?.source === id && plugin.version === version, 'startup did not load installed plugin');
    if (mode === 'git') assert(plugin.path.startsWith(config), 'Git install resolved outside isolated cache');
    assert.deepEqual(init.mcp_servers, [], 'unexpected MCP startup');
    const result = messages.find(m => m.type === 'result');
    assert(result && !result.is_error && result.num_turns === 0 && result.duration_api_ms === 0,
      'smoke test must not perform model inference');
    console.log(`${mode} marketplace: user install ${version}; normal CLI startup discovers four Skills, zero MCPs/hooks; no model call`);
  }
} finally { rmSync(work, { recursive: true, force: true }); }
