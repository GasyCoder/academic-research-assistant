#!/usr/bin/env node
/*
 * Validates research profiles (YAML) against schemas/research-profile.schema.json.
 * Usage: node scripts/validate-profiles.mjs [profile.yaml ...]
 * Without arguments: profiles/default.yaml and every .yaml/.yml file in profiles/local/.
 *
 * Checks, in order: YAML 1.2 syntax (duplicate keys and multiple documents are errors), a
 * mapping at the root, the JSON Schema (Ajv, strict mode), then rules a schema cannot express:
 * a language variant must start with its primary language, an abstract word limit cannot exceed
 * the document's, and no key or value may look like a secret. Values are never echoed in errors.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseAllDocuments } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schemas', 'research-profile.schema.json'), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

/** Keys that would hold credentials. A research profile never needs them. */
const SECRET_KEY = /(password|passwd|passphrase|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential)/i;
/** Well-known credential formats. */
const SECRET_VALUE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(sk|pk|rk)-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/,
];

function describeSchemaError(error) {
  const path = error.instancePath || '(root)';
  if (error.keyword === 'additionalProperties') {
    return `${path}: unknown key "${error.params.additionalProperty}"`;
  }
  if (error.keyword === 'const') {
    return `${path}: must be ${JSON.stringify(error.params.allowedValue)}`;
  }
  if (error.keyword === 'enum') {
    return `${path}: must be one of ${error.params.allowedValues.join(', ')}`;
  }
  if (error.keyword === 'if') {
    return null; // Ajv reports the failing "then" requirement separately.
  }
  return `${path}: ${error.message}`;
}

/** Paths of keys or string values that look like credentials. */
function secretPaths(value, path = '') {
  if (typeof value === 'string') {
    return SECRET_VALUE.some((pattern) => pattern.test(value)) ? [`${path || '(root)'}: value looks like a secret`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => secretPaths(item, `${path}/${index}`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(SECRET_KEY.test(key) ? [`${path}/${key}: secrets must not be stored in a research profile`] : []),
      ...secretPaths(item, `${path}/${key}`),
    ]);
  }
  return [];
}

/** Returns the problems of a profile's YAML text, as "path: message" strings; empty when valid. */
export function validateProfile(text) {
  const documents = parseAllDocuments(text, { uniqueKeys: true });
  if (documents.length === 0) {
    return ['(root): the file is empty; a profile needs at least profileVersion'];
  }
  if (documents.length !== 1) {
    return [`(root): expected one YAML document, found ${documents.length}`];
  }
  const [document] = documents;
  if (document.errors.length > 0) {
    return document.errors.map((error) => {
      const line = error.linePos?.[0]?.line;
      return `(yaml)${line ? ` line ${line}` : ''}: ${error.message.split('\n')[0]}`;
    });
  }
  const profile = document.toJS();
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    return ['(root): a profile must be a YAML mapping of keys to values'];
  }

  const problems = [];
  if (!validateSchema(profile)) {
    problems.push(...validateSchema.errors.map(describeSchemaError).filter((problem) => problem !== null));
  }
  const { language, venue } = profile;
  if (typeof language?.primary === 'string' && typeof language.variant === 'string' && !language.variant.startsWith(`${language.primary}-`)) {
    problems.push(`/language/variant: must start with the primary language "${language.primary}-"`);
  }
  if (Number.isInteger(venue?.wordLimit) && Number.isInteger(venue?.abstractWordLimit) && venue.abstractWordLimit > venue.wordLimit) {
    problems.push('/venue/abstractWordLimit: cannot exceed venue.wordLimit');
  }
  problems.push(...secretPaths(profile));
  return problems;
}

function defaultTargets() {
  const local = join(root, 'profiles', 'local');
  const localProfiles = existsSync(local)
    ? readdirSync(local).filter((name) => /\.ya?ml$/.test(name)).sort().map((name) => join(local, name))
    : [];
  return [join(root, 'profiles', 'default.yaml'), ...localProfiles];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const targets = process.argv.length > 2 ? process.argv.slice(2).map((path) => resolve(path)) : defaultTargets();
  let failures = 0;
  for (const file of targets) {
    const name = relative(process.cwd(), file) || file;
    if (!existsSync(file)) {
      console.error(`${name}: file not found`);
      failures++;
      continue;
    }
    const problems = validateProfile(readFileSync(file, 'utf8'));
    if (problems.length > 0) {
      failures++;
      for (const problem of problems) {
        console.error(`${name}: ${problem}`);
      }
    } else {
      console.log(`${name}: valid`);
    }
  }
  if (failures > 0) {
    console.error(`${failures} invalid profile(s)`);
    process.exit(1);
  }
}
