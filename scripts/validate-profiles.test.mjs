import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateProfile } from './validate-profiles.mjs';

const validator = fileURLToPath(new URL('./validate-profiles.mjs', import.meta.url));
const example = readFileSync(new URL('../profiles/default.yaml', import.meta.url), 'utf8');

/** Synthetic profile using every section; not a real project. */
const complete = `
profileVersion: 1
id: sample-project
project:
  title: Working title
  topic: Topic in one sentence
  keywords: [first, second]
discipline:
  name: Discipline name
  field: Field name
methodology:
  approaches: [qualitative, computational]
  methods: [interviews, simulations]
document:
  type: thesis
  currentSection: Methods
language:
  primary: en
  variant: en-GB
citationStyle:
  name: APA
  edition: 7
voice:
  preference: impersonal
sections:
  expected: [Introduction, Methods, Results, Discussion]
  resultsAndDiscussion: separate
  abstract:
    structured: false
venue:
  name: Venue name
  wordLimit: 8000
  abstractWordLimit: 250
  requiredSections: [Ethics statement]
  styleNotes: [Use SI units]
  guidelinesCheckedOn: 2026-01-15
  source: venue-guidelines
terminology:
  preferred:
    - term: participant
      insteadOf: [subject]
  avoid: [very significant]
  abbreviations:
    - abbreviation: ABC
      expansion: Expansion
  protected: [Exact Instrument Name]
`;

const valid = (text) => assert.deepEqual(validateProfile(text), []);
const invalid = (text, pattern) => {
  const problems = validateProfile(text);
  assert.ok(
    problems.some((problem) => pattern.test(problem)),
    `expected a problem matching ${pattern}, got ${JSON.stringify(problems)}`,
  );
  return problems;
};

test('accepts the repository example, and its commented examples once uncommented', () => {
  valid(example);
  valid(example.split('\n').map((line) => (line.startsWith('# ') ? line.slice(2) : line)).join('\n'));
});

test('accepts a profile using every section', () => valid(complete));

test('accepts a profile with only the format version: everything else is unknown', () => valid('profileVersion: 1\n'));

test('rejects invalid YAML with its line', () => invalid('profileVersion: 1\nproject: [unclosed\n', /^\(yaml\) line \d+:/));

test('rejects a missing or unsupported format version', () => {
  invalid('project:\n  title: Title\n', /^\(root\): must have required property 'profileVersion'/);
  invalid('profileVersion: 2\n', /^\/profileVersion: must be 1$/);
  invalid('profileVersion: "1"\n', /^\/profileVersion: must be 1$/);
});

test('rejects wrong types', () => {
  invalid('profileVersion: 1\nvenue:\n  wordLimit: eight thousand\n', /^\/venue\/wordLimit: must be integer$/);
  invalid('profileVersion: 1\nsections:\n  abstract:\n    structured: yes\n', /^\/sections\/abstract\/structured: must be boolean$/);
});

test('rejects unknown keys, including misspelt ones', () => {
  invalid('profileVersion: 1\ncitation_style:\n  name: APA\n', /^\(root\): unknown key "citation_style"$/);
  invalid('profileVersion: 1\ndiscipline:\n  feild: Field\n', /^\/discipline: unknown key "feild"$/);
});

test('accepts local x- extensions', () => valid('profileVersion: 1\nx-team-notes: Shared drafting conventions\n'));

test('accepts several methodology approaches, and requires notes for other', () => {
  valid('profileVersion: 1\nmethodology:\n  approaches: [qualitative, quantitative, theoretical]\n');
  invalid('profileVersion: 1\nmethodology:\n  approaches: [other]\n', /^\/methodology: must have required property 'notes'$/);
  valid('profileVersion: 1\nmethodology:\n  approaches: [other]\n  notes: Participatory design\n');
  invalid('profileVersion: 1\nmethodology:\n  approaches: [quantitive]\n', /^\/methodology\/approaches\/0: must be one of /);
  invalid('profileVersion: 1\nmethodology:\n  approaches: [mixed, mixed]\n', /duplicate items/);
});

test('validates languages and variants', () => {
  valid('profileVersion: 1\nlanguage:\n  primary: fr\n');
  valid('profileVersion: 1\nlanguage:\n  primary: fr\n  variant: fr-CA\n');
  invalid('profileVersion: 1\nlanguage:\n  primary: en\n  variant: fr-CA\n', /^\/language\/variant: must start with the primary language/);
  invalid('profileVersion: 1\nlanguage:\n  primary: English\n', /^\/language\/primary: must match pattern/);
  invalid('profileVersion: 1\nlanguage:\n  variant: en-GB\n', /^\/language: must have required property 'primary'$/);
});

test('accepts custom citation styles and a document type described as other', () => {
  valid('profileVersion: 1\ncitationStyle:\n  name: Department style\n  notes: Author-date, as in the department handbook\n');
  valid('profileVersion: 1\ncitationStyle:\n  name: Chicago author-date\n  edition: "17"\n');
  invalid('profileVersion: 1\ndocument:\n  type: other\n', /^\/document: must have required property 'typeNote'$/);
  invalid('profileVersion: 1\ndocument:\n  type: essay\n', /^\/document\/type: must be one of /);
});

test('validates terminology lists and rejects a scalar where a list is expected', () => {
  valid('profileVersion: 1\nterminology:\n  protected: [Model X]\n  avoid: [prove]\n');
  invalid('profileVersion: 1\nterminology:\n  protected: Model X\n', /^\/terminology\/protected: must be array$/);
  invalid('profileVersion: 1\nterminology:\n  abbreviations:\n    - abbreviation: ABC\n', /must have required property 'expansion'/);
});

test('validates venue requirements', () => {
  valid('profileVersion: 1\nvenue:\n  name: Venue\n  wordLimit: 6000\n  abstractWordLimit: 200\n');
  invalid('profileVersion: 1\nvenue:\n  wordLimit: 200\n  abstractWordLimit: 300\n', /^\/venue\/abstractWordLimit: cannot exceed venue\.wordLimit$/);
  invalid('profileVersion: 1\nvenue:\n  wordLimit: 0\n', /^\/venue\/wordLimit: must be >= 1$/);
  invalid('profileVersion: 1\nvenue:\n  guidelinesCheckedOn: 15/01/2026\n', /^\/venue\/guidelinesCheckedOn: must match pattern/);
});

test('has one representation of unknown: no null, empty text or empty list', () => {
  invalid('profileVersion: 1\nproject:\n  title: null\n', /^\/project\/title: must be string$/);
  invalid('profileVersion: 1\nproject:\n  title: ""\n', /^\/project\/title: must NOT have fewer than 1 characters$/);
  invalid('profileVersion: 1\nproject:\n  keywords: []\n', /^\/project\/keywords: must NOT have fewer than 1 items$/);
  invalid('profileVersion: 1\nproject: {}\n', /^\/project: must NOT have fewer than 1 properties$/);
});

test('rejects malformed documents', () => {
  invalid('', /^\(root\): the file is empty/);
  invalid('- profileVersion: 1\n', /^\(root\): a profile must be a YAML mapping/);
  invalid('profileVersion: 1\n---\nprofileVersion: 1\n', /^\(root\): expected one YAML document, found 2$/);
  invalid('profileVersion: 1\nprofileVersion: 1\n', /^\(yaml\) line 2: Map keys must be unique/);
});

test('rejects secret-like keys and values without echoing them', () => {
  invalid('profileVersion: 1\nx-api-key: abc123\n', /^\/x-api-key: secrets must not be stored/);
  invalid('profileVersion: 1\nx-service:\n  password: hunter2\n', /^\/x-service\/password: secrets must not be stored/);
  const secret = `sk-${'a1B2c3D4'.repeat(4)}`;
  const problems = invalid(`profileVersion: 1\nproject:\n  topic: "${secret}"\n`, /^\/project\/topic: value looks like a secret$/);
  assert.ok(problems.every((problem) => !problem.includes(secret)));
});

test('handles unresolved, cyclic and excessive aliases without throwing or echoing input', () => {
  const marker = `sk-${'SYNTHETIC'.repeat(4)}`;
  for (const body of [
    `x-team: *${marker}\n`,
    'x-team: &self {again: *self}\n',
    `x-first: &first [a, b]\nx-second: &second [${Array(12).fill('*first').join(', ')}]\nx-third: [${Array(12).fill('*second').join(', ')}]\n`,
  ]) {
    const problems = invalid(`profileVersion: 1\n${body}`, /\(yaml\)/);
    assert.ok(problems.every((problem) => !problem.includes(marker)));
  }
  valid('profileVersion: 1\nx-first: &first {label: Shared context}\nx-second: *first\n');
});

test('rejects unsupported tags, YAML 1.1, collection keys and non-finite numbers', () => {
  for (const text of [
    'profileVersion: 1\nx-team: !academic ordinary text\n',
    'profileVersion: 1\nx-team: !!int not-an-integer\n',
    'profileVersion: 1\nx-team: !!binary aGVsbG8=\n',
    '%YAML 1.1\n---\nprofileVersion: 1\nx-team: yes\n',
    'profileVersion: 1\nx-team: {? [first, second]: text}\n',
    'profileVersion: 1\nx-team: .nan\n',
    'profileVersion: 1\nx-team: .inf\n',
  ]) invalid(text, /\(yaml\)/);
});

test('detects credential key components without rejecting academic vocabulary', () => {
  for (const key of ['apiKey', 'api_key', 'api-key', 'token', 'accessToken', 'password', 'secret', 'clientSecret', 'privateKey', 'databasePassword']) {
    invalid(`profileVersion: 1\nx-provider:\n  ${key}: synthetic-value\n`, /secrets must not be stored/);
  }
  for (const key of ['secretary', 'tokenization', 'passwordPolicy']) {
    valid(`profileVersion: 1\nx-project:\n  ${key}: Academic context\n`);
  }
  valid('profileVersion: 1\nproject:\n  topic: The concept of a secret in API design\n');
});

test('checks credential values in extensions and notes, and redacts credential-shaped keys', () => {
  const marker = `sk-${'SYNTHETIC'.repeat(4)}`;
  for (const body of [
    `x-provider: {nested: {value: '${marker}'}}\n`,
    `venue: {styleNotes: ['${marker}']}\n`,
    `project: {topic: '${marker}'}\n`,
    `${marker}: some text\n`,
    `x-provider: {'${marker}': some text}\n`,
  ]) {
    const problems = invalid(`profileVersion: 1\n${body}`, /secret|redacted/);
    assert.ok(problems.every((problem) => !problem.includes(marker)));
  }
});

test('extensions obey the same non-empty unknown contract, while false remains a value', () => {
  for (const value of ['null', '""', '[]', '{}', '{note: null}', '[[]]']) {
    invalid(`profileVersion: 1\nx-context: ${value}\n`, /\/x-context/);
  }
  valid('profileVersion: 1\nx-context: {enabled: false, count: 0, notes: [Local context]}\n');
  invalid('profileVersion: 1\nproject: {x-context: Local context}\n', /unknown key/);
});

test('accepts case-insensitive language prefixes and complex variant subtags without coercion', () => {
  for (const [primary, variant] of [['en','en-US'], ['en','en-GB'], ['fr','fr-FR'], ['pt','pt-BR'], ['EN','en-gb'], ['en','EN-us'], ['en','en-US-u-ca-gregory'], ['zh','zh-Hant-TW'], ['en','en-x-project']]) {
    valid(`profileVersion: 1\nlanguage: {primary: ${primary}, variant: ${variant}}\n`);
  }
  invalid('profileVersion: 1\nlanguage: {primary: en, variant: enx-US}\n', /must start with the primary language/);
});

test('rejects conflicting or repeated abbreviation entries', () => {
  for (const expansion of ['First meaning', 'Second meaning']) {
    invalid(`profileVersion: 1\nterminology:\n  abbreviations:\n    - {abbreviation: ABC, expansion: First meaning}\n    - {abbreviation: ABC, expansion: '${expansion}'}\n`, /duplicate abbreviation/);
  }
});

test('requires a real calendar date for venue guidelines', () => {
  invalid('profileVersion: 1\nvenue: {guidelinesCheckedOn: 2026-02-31}\n', /valid calendar date/);
  valid('profileVersion: 1\nvenue: {guidelinesCheckedOn: 2024-02-29}\n');
});

test('the CLI handles missing files, directories, spaces and unsafe YAML without a stack trace', () => {
  const directory = mkdtempSync(join(tmpdir(), 'research-profile-cli-'));
  try {
    const good = join(directory, 'profile with spaces.json');
    const unsafe = join(directory, 'unsafe.yaml');
    const missing = join(directory, 'absent.yaml');
    const marker = `sk-${'SYNTHETIC'.repeat(4)}`;
    writeFileSync(good, '{"profileVersion":1}');
    writeFileSync(unsafe, `profileVersion: 1\nx-context: *${marker}\n`);
    const result = spawnSync(process.execPath, [validator, missing, directory, unsafe, good], {encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /file not found/);
    assert.match(result.stderr, /unable to read profile/);
    assert.match(result.stdout, /profile with spaces\.json: valid/);
    assert.ok(!result.stderr.includes(marker));
    assert.ok(!/\n\s+at /.test(result.stderr));
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});

test('the command validates the given files and fails with their path', () => {
  const directory = mkdtempSync(join(tmpdir(), 'research-profile-test-'));
  try {
    const good = join(directory, 'good.yaml');
    const bad = join(directory, 'bad.yaml');
    writeFileSync(good, 'profileVersion: 1\n');
    writeFileSync(bad, 'profileVersion: 1\nx-token: s3cr3t-value\n');
    const ok = spawnSync(process.execPath, [validator, good], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /good\.yaml: valid/);
    const ko = spawnSync(process.execPath, [validator, good, bad], { encoding: 'utf8' });
    assert.equal(ko.status, 1);
    assert.match(ko.stderr, /bad\.yaml: \/x-token: secrets must not be stored/);
    assert.ok(!ko.stderr.includes('s3cr3t-value'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
