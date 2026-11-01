import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { anchors, checkLinks, checkVersions } from './distribution-validation.mjs';

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
