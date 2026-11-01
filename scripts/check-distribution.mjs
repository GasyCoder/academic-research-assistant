/* Pack/install/import/bin checks outside the checkout. No publication or live provider call. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'ara-distribution-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { PATH: process.env.PATH ?? '', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };
try {
  const tarballs = [];
  for (const directory of ['document-formats', 'research-integrations-mcp']) {
    const packageRoot = join(root, 'packages', directory);
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    const [packed] = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', work],
      { cwd: packageRoot, encoding: 'utf8' }));
    assert(packed?.filename, 'npm pack must return an archive');
    const modules = directory === 'document-formats' ? ['docx','index','latex','markdown','model'] :
      ['config','contracts','http','index','metadata','providers','server','service','vale','version'];
    const expected = ['package.json', 'LICENSE', ...(directory === 'research-integrations-mcp' ? ['README.md'] : []),
      ...modules.flatMap(name => [`dist/${name}.js`, `dist/${name}.d.ts`])];
    const paths = packed.files.map(file => file.path);
    for (const path of expected) assert(paths.includes(path), `missing package file: ${path}`);
    for (const file of packed.files) {
      assert(expected.includes(file.path) || /^(README\.md|LICEN[CS]E(?:\.md|\.txt)?)$/iu.test(file.path), `unexpected package file: ${file.path}`);
      assert(file.size < 256 * 1024, 'unexpected large package file');
    }
    assert.equal(manifest.private, true, 'no publication authorized');
    assert.equal(manifest.license, 'Apache-2.0', 'owner-approved license metadata required');
    tarballs.push(join(work, packed.filename));
    console.log(`${manifest.name}@${manifest.version}: ${paths.length} expected tarball files`);
  }
  const project = join(work, 'project'); mkdirSync(project);
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'ara-install-smoke', private: true, type: 'module' }));
  const npmrc = join(work, 'npmrc'); writeFileSync(npmrc, '');
  execFileSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--userconfig', npmrc, ...tarballs],
    { cwd: project, env, stdio: 'pipe', timeout: 120_000 });
  for (const name of ['typescript','vitest','tsx','@modelcontextprotocol/client'])
    assert(!existsSync(join(project, 'node_modules', name)), 'development dependencies leaked into installation');

  // This probe resolves imports from the independent installation, not from the parent harness.
  const probe = `import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {readDocument,proposeReplacement} from '@gasycoder/document-formats';
import {createIntegrations} from '@gasycoder/research-integrations-mcp';
for(const name of ['@gasycoder/document-formats','@gasycoder/research-integrations-mcp']){
 const path=realpathSync(fileURLToPath(import.meta.resolve(name)));
 assert(path.startsWith(realpathSync('./node_modules')+'/'),'package resolved outside clean room');
}
const source='The **reslts** are clear [1].';
const doc=await readDocument(source,{format:'markdown'});
const segment=doc.segments.find(s=>s.text==='reslts');assert(segment);
const proposal=proposeReplacement(doc,{revision:doc.revision,segmentId:segment.id,offset:0,length:6},'results');
assert.equal(source.slice(proposal.location.start,proposal.location.end),'reslts');assert.equal(proposal.applied,false);
const tools=createIntegrations({});
assert.equal((await tools.crossrefLookup({doi:'10.5555/synthetic'})).status,'verification_not_performed');
assert.equal((await tools.valeCheck({text:'Synthetic prose.'})).error.code,'VALE_UNAVAILABLE');
console.log('Clean-room library imports, mapping, consent gate and optional-tool absence passed');`;
  writeFileSync(join(project, 'probe.mjs'), probe);
  console.log(execFileSync(process.execPath, ['probe.mjs'], { cwd: project, env, encoding: 'utf8' }).trim());

  const bin = join(project, 'node_modules', '.bin', process.platform === 'win32' ? 'research-integrations-mcp.cmd' : 'research-integrations-mcp');
  const transport = new StdioClientTransport({ command: bin, cwd: project, env, stderr: 'pipe' });
  const client = new Client({ name: 'clean-room-distribution-check', version: '0' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  try {
    await client.connect(transport);
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(client.getServerVersion().version, manifest.version);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['crossref_lookup_doi','crossref_search_works','openalex_lookup_work',
      'openalex_search_works','vale_check','zotero_get_item','zotero_search_items']);
    const result = await client.callTool({ name: 'crossref_lookup_doi', arguments: { doi: '10.5555/synthetic' } });
    assert.equal(result.structuredContent.status, 'verification_not_performed');
    assert.equal(result.structuredContent.records.length, 0);
    assert(!stderr.includes('10.5555/synthetic'), 'query leaked to stderr');
    console.log('Installed research-integrations-mcp binary: 7 tools, matching version, no-consent call passed');
  } finally { await client.close(); }
} finally { rmSync(work, { recursive: true, force: true }); }
