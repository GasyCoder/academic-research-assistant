import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('./validate-skills.mjs', import.meta.url));
const frontmatter = '---\nname: sample\ndescription: Reviews scholarly prose when asked for academic writing guidance.\n---\n';

function validate(text, extraFiles = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'academic-skills-test-'));
  try {
    const skill = join(directory, 'sample');
    mkdirSync(skill);
    writeFileSync(join(skill, 'SKILL.md'), text);
    for (const [name, content] of Object.entries(extraFiles)) {
      writeFileSync(join(skill, name), content);
    }
    const result = spawnSync(process.execPath, [validator, directory], { encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const [heading, anchor] of [
  ["Étude d'un texte (version 2)", 'étude-dun-texte-version-2'],
  ['Plusieurs   espaces', 'plusieurs---espaces'],
  ['中文 标题', '中文-标题'],
  ['Cafe\u0301', 'cafe\u0301'],
]) {
  test(`accepts the heading anchor for ${heading}`, () => {
    const result = validate(`${frontmatter}# ${heading}\n\n[link](#${anchor})\n`);
    assert.equal(result.status, 0, result.stderr);
  });
}

test('numbers duplicate headings without colliding with existing anchors', () => {
  const text = '# Repeat\n\n# Repeat\n\n# Repeat-1\n\n# Repeat\n\n' +
    '[first](#repeat) [second](#repeat-1) [third](#repeat-1-1) [fourth](#repeat-2)\n';
  const result = validate(frontmatter + text);
  assert.equal(result.status, 0, result.stderr);
});

test('resolves relative file links and anchors in the target file', () => {
  const result = validate(`${frontmatter}[criteria](criteria.md#précision)\n`, { 'criteria.md': '# Précision\n' });
  assert.equal(result.status, 0, result.stderr);
});

test('reports broken links and missing anchors with a file location', () => {
  const result = validate(`${frontmatter}# Actual\n\n[missing](absent.md) [anchor](#wrong)\n`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sample\/SKILL\.md: broken link absent\.md/);
  assert.match(result.stderr, /missing anchor #wrong/);
});

test('rejects a misspelled frontmatter key', () => {
  const result = validate(frontmatter.replace('description:', 'descripton:'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown frontmatter key "descripton"/);
});

test('rejects duplicate frontmatter keys', () => {
  const result = validate(frontmatter.replace('name: sample', 'name: other\nname: sample'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate frontmatter key "name"/);
});

test('rejects an unquoted YAML mapping inside a plain scalar', () => {
  const result = validate(frontmatter.replace('Reviews scholarly', 'Reviews prose: scholarly'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported frontmatter value/);
});

test('accepts CRLF frontmatter', () => {
  const result = validate(frontmatter.replaceAll('\n', '\r\n'));
  assert.equal(result.status, 0, result.stderr);
});

test('accepts the standard compatibility field', () => {
  const result = validate(frontmatter.replace('name: sample', 'name: sample\ncompatibility: Requires a Skill-capable agent'));
  assert.equal(result.status, 0, result.stderr);
});

test('rejects researcher-specific content but accepts generic institutions', () => {
  const specific = validate(`${frontmatter}Researcher Florent uses this method.\n`);
  assert.equal(specific.status, 1);
  assert.match(specific.stderr, /researcher-specific term "Florent"/);
  assert.equal(validate(`${frontmatter}Follow the author's institution and journal conventions.\n`).status, 0);
});

test('continues to accept the explicit future-skill placeholders', () => {
  assert.equal(validate('# Future skill\n\nPlaceholder for a later phase.\n').status, 0);
});
