import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { anchors, checkLinks, checkVersions, checkMarketplace } from './distribution-validation.mjs';

const manifests = () => Object.fromEntries(['root','languagetool','integrations','formats'].map(key =>
  [key, { version: key === 'formats' ? '0.1.0' : '0.3.0', private: true, engines: { node: '>=20' }, license: 'Apache-2.0' }]));
const plugin = { name: 'academic-research-assistant', version: '0.3.0', license: 'Apache-2.0' };
test('accepts the internal library exception and synchronized runtime/plugin versions', () => {
  assert.deepEqual(checkVersions(manifests(), plugin), []);
});
test('rejects stale runtime/plugin versions and accidental publication', () => {
  const changed = manifests(); changed.integrations.version = '0.2.0'; changed.root.private = false;
  assert.equal(checkVersions(changed, { ...plugin, version: '0.1.0' }).length, 3);
});
test('refuses automatic plugin execution surfaces', () => {
  assert.equal(checkVersions(manifests(), { ...plugin, mcpServers: {} }).length, 1);
});
test('rejects missing or conflicting owner-approved license metadata', () => {
  const changed = manifests(); delete changed.formats.license;
  assert.deepEqual(checkVersions(changed, { ...plugin, license: 'MIT' }), [
    'plugin must use the owner-approved Apache-2.0 license',
    'formats must use the owner-approved Apache-2.0 license',
  ]);
});
const marketplace = () => ({ name: 'gasycoder-academic-tools', owner: { name: 'GasyCoder' },
  description: 'Academic tools', plugins: [{ name: plugin.name, source: './', description: 'Four Skills' }] });
test('accepts the root plugin catalog without a duplicate version source', () => {
  assert.deepEqual(checkMarketplace(marketplace(), plugin), []);
});
test('rejects marketplace identity drift and missing or malformed entries', () => {
  assert.deepEqual(checkMarketplace(null, plugin), ['marketplace must be an object']);
  assert(checkMarketplace({ ...marketplace(), name: 'other', owner: {}, plugins: [] }, plugin).length === 3);
  assert.deepEqual(checkMarketplace({ ...marketplace(), plugins: [null] }, plugin), ['marketplace plugin entry must be an object']);
  const changed = marketplace(); changed.plugins[0].name = 'other';
  assert.deepEqual(checkMarketplace(changed, plugin), ['marketplace plugin name differs from plugin manifest']);
});
test('rejects escaped, remote or missing plugin sources instead of changing the root contract', () => {
  for (const source of ['../', './missing', '/absolute/plugin', { source: 'github', repo: 'example/plugin' }, undefined]) {
    const changed = marketplace(); changed.plugins[0].source = source;
    assert.deepEqual(checkMarketplace(changed, plugin), ['marketplace plugin source must remain ./']);
  }
});
test('rejects marketplace version overrides and executable component additions', () => {
  for (const extra of [{ version: '0.3.0' }, { mcpServers: {} }, { hooks: {} }]) {
    const changed = marketplace(); Object.assign(changed.plugins[0], extra);
    assert.deepEqual(checkMarketplace(changed, plugin), ['marketplace entry must use plugin manifest metadata without extra components']);
  }
});
test('computes Unicode, duplicate, inline-code and underscore heading anchors outside fences', () => {
  assert.deepEqual([...anchors('# Étude `a_b`\n# Repeat\n# Repeat\n```md\n# Hidden\n```')], ['étude-a_b','repeat','repeat-1']);
});
test('checks relative files, references, fragments and encoded filenames while ignoring fenced examples/remote URLs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ara-links-'));
  try {
    const source = join(root, 'README.md');
    writeFileSync(join(root, 'Other File.md'), '# Visible\n');
    writeFileSync(source, '[ok](Other%20File.md#visible)\n[x]: Other%20File.md#visible\n[web](https://example.invalid/)\n```md\n[placeholder](missing.md)\n```');
    assert.deepEqual(checkLinks(source, root), []);
    writeFileSync(source, '[absent](missing.md)\n[bad](Other%20File.md#missing)\n[x]: absent.md');
    assert.equal(checkLinks(source, root).length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
