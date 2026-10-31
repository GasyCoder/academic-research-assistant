import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateDisciplineCatalog, validateDisciplineProfile } from './validate-disciplines.mjs';

const validator = fileURLToPath(new URL('./validate-disciplines.mjs', import.meta.url));
const directory = new URL('../profiles/disciplines/', import.meta.url);
const basic = 'disciplineProfileVersion: 1\nid: sample-discipline\nlabel: Sample discipline\ndescription: Generic conditional guidance\n';
const valid = (text) => assert.deepEqual(validateDisciplineProfile(text), []);
const invalid = (text, pattern) => {
  const problems = validateDisciplineProfile(text);
  assert.ok(problems.some((problem) => pattern.test(problem)), JSON.stringify(problems));
  return problems;
};

test('all shipped discipline profiles are valid together', () => {
  const files = readdirSync(directory).filter((name) => /\.ya?ml$/.test(name));
  assert.equal(files.length, 5);
  const texts = files.map((name) => readFileSync(new URL(name, directory), 'utf8'));
  assert.deepEqual(validateDisciplineCatalog(texts), texts.map(() => []));
});

test('accepts the minimal identity and every optional guidance section without defaults', () => {
  valid(basic);
  valid(basic + 'aliases: [sample studies]\n' + ['writing', 'structure', 'methodology', 'evidence', 'citations', 'review'].map((key) => `${key}: [Conditional guidance]\n`).join(''));
});

test('requires dedicated version, id, label and description', () => {
  for (const field of ['disciplineProfileVersion', 'id', 'label', 'description']) {
    invalid(basic.split('\n').filter((line) => !line.startsWith(`${field}:`)).join('\n'), new RegExp(`required property '${field}'`));
  }
  for (const version of ['2', '"1"', 'null']) invalid(basic.replace('Version: 1', `Version: ${version}`), /disciplineProfileVersion: must be 1/);
});

test('rejects invalid ids, unknown keys and extensions not supported by this format', () => {
  for (const id of ['UpperCase', 'two words', '-invalid', 'a'.repeat(65)]) invalid(basic.replace('sample-discipline', id), /\/id:/);
  invalid(basic + 'writting: [Guidance]\n', /unknown key "writting"/);
  invalid(basic + 'x-context: Guidance\n', /unknown key "x-context"/);
  invalid(basic + 'methodology: {approaches: [qualitative]}\n', /\/methodology: must be array/);
});

test('rejects empty, null and wrongly typed values without coercion', () => {
  for (const value of ['""', '"   "', 'null', '1']) invalid(basic.replace('label: Sample discipline', `label: ${value}`), /\/label:/);
  for (const value of ['[]', '[""]', '[null]', 'null', 'Guidance']) invalid(basic + `writing: ${value}\n`, /\/writing/);
  invalid(basic + 'review: [Same, Same]\n', /duplicate items/);
});

test('detects duplicate ids across different files, reporting both inputs', () => {
  const results = validateDisciplineCatalog([basic, basic.replace('Sample discipline', 'Another label')]);
  assert.ok(results.every((problems) => problems.some((problem) => /\/id: duplicate id or alias/.test(problem))));
});

test('detects normalized aliases and id/alias collisions locally and across files', () => {
  invalid(basic + 'aliases: [Computing, " computing "]\n', /duplicate id or alias/);
  invalid(basic + 'aliases: ["sample-discipline"]\n', /duplicate id or alias/);
  const other = basic.replace('sample-discipline', 'other-discipline');
  for (const [first, second] of [
    [basic + 'aliases: [Computing]\n', other + 'aliases: [" COMPUTING "]\n'],
    [basic + 'aliases: [other-discipline]\n', other],
    [other, basic + 'aliases: [other-discipline]\n'],
    [basic + 'aliases: ["sample  studies"]\n', other + 'aliases: ["sample studies"]\n'],
    [basic + 'aliases: ["Ｃｏｍｐｕｔｉｎｇ"]\n', other + 'aliases: [computing]\n'],
  ]) assert.ok(validateDisciplineCatalog([first, second]).every((problems) => problems.some((problem) => /duplicate id or alias/.test(problem))));
});

test('rejects non-mappings, malformed YAML, duplicate keys and multiple documents', () => {
  invalid('', /file is empty/);
  invalid('[]', /YAML mapping/);
  invalid('text', /YAML mapping/);
  invalid(basic + 'writing: [unclosed', /\(yaml\) line/);
  invalid(basic + 'id: another\n', /Map keys must be unique/);
  invalid(basic + '---\n' + basic, /expected one YAML document/);
  invalid(undefined, /expected YAML text/);
});

test('shares YAML protections for tags, versions, aliases and non-finite values', () => {
  for (const text of [
    basic + 'writing: !custom [Guidance]\n',
    basic + 'writing: !!binary aGVsbG8=\n',
    '%YAML 1.1\n---\n' + basic,
    basic + 'writing: *missing\n',
    basic + 'writing: &self [*self]\n',
    basic + 'writing: [.nan]\n',
    basic + 'writing: [.inf]\n',
    basic + 'writing: {? [a, b]: text}\n',
    basic + `writing: &first [a, b]\nstructure: &second [${Array(12).fill('*first').join(', ')}]\nreview: [${Array(12).fill('*second').join(', ')}]\n`,
  ]) invalid(text, /\(yaml\)/);
  valid(basic + 'writing: &guidance [Conditional guidance]\nstructure: *guidance\n');
});

test('does not leak credential-shaped values through schema, YAML or catalog errors', () => {
  const marker = `sk-${'SYNTHETIC'.repeat(4)}`;
  for (const body of [`writing: ['${marker}']\n`, `${marker}: value\n`, `writing: *${marker}\n`, 'apiKey: synthetic-value\n']) {
    const problems = invalid(basic + body, /secret|redacted|\(yaml\)/);
    assert.ok(problems.every((problem) => !problem.includes(marker)));
  }
  const results = validateDisciplineCatalog([basic + `aliases: ['${marker}']\n`, basic + `aliases: ['${marker}']\n`]);
  assert.ok(results.flat().every((problem) => !problem.includes(marker)));
});

test('CLI validates explicit paths, catches catalog collisions and handles unreadable inputs', () => {
  const temp = mkdtempSync(join(tmpdir(), 'discipline-cli-'));
  try {
    const first = join(temp, 'first profile.yaml');
    const second = join(temp, 'second.yaml');
    writeFileSync(first, basic);
    writeFileSync(second, basic);
    const run = (...args) => {
      const result = spawnSync(process.execPath, [validator, ...args], { encoding: 'utf8' });
      assert.ifError(result.error);
      assert.ok(!/\n\s+at /.test(result.stderr));
      return result;
    };
    const ok = run(first);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /first profile.yaml: valid/);
    const duplicate = run(first, second);
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /duplicate id or alias/);
    const unreadable = run(join(temp, 'absent.yaml'), temp, first);
    assert.equal(unreadable.status, 1);
    assert.match(unreadable.stderr, /unable to read discipline profile/);
    assert.match(unreadable.stdout, /first profile.yaml: valid/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
