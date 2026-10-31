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
const SECRET_KEY = /(?:^|-)(password|passwd|passphrase|secret|token|api-key|access-key|private-key|credentials?)$/;
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
  const path = safePath(error.instancePath) || '(root)';
  if (error.keyword === 'additionalProperties') {
    return `${path}: unknown key "${safeKey(error.params.additionalProperty)}"`;
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

const looksLikeSecret = (value) => SECRET_VALUE.some((pattern) => pattern.test(value));
const safeKey = (key) => looksLikeSecret(key) ? '[redacted]' : key;
const safePath = (path) => path.split('/').map(safeKey).join('/');
const pointerKey = (key) => safeKey(key).replace(/~/g, '~0').replace(/\//g, '~1');
const isSecretKey = (key) => SECRET_KEY.test(key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/_/g, '-'));

/** JSON Schema assumes finite JSON values, not cyclic alias graphs or YAML infinities. */
function jsonProblem(value, ancestors = new WeakSet()) {
  if (typeof value === 'number' && !Number.isFinite(value)) return '(yaml): non-finite numbers are not supported';
  if (value === null || typeof value !== 'object') return null;
  if (ancestors.has(value)) return '(yaml): cyclic aliases are not supported';
  ancestors.add(value);
  for (const item of Object.values(value)) {
    const problem = jsonProblem(item, ancestors);
    if (problem) return problem;
  }
  ancestors.delete(value);
  return null;
}

/** Library diagnostics may quote input; report only controlled text and the location. */
function yamlProblem(error) {
  const line = error.linePos?.[0]?.line;
  const message = error.code === 'DUPLICATE_KEY' ? 'Map keys must be unique' : `invalid or unsupported YAML (${error.code})`;
  return `(yaml)${line ? ` line ${line}` : ''}: ${message}`;
}

/** Paths of keys or string values that look like credentials. */
function secretPaths(value, path = '') {
  if (typeof value === 'string') {
    return looksLikeSecret(value) ? [`${path || '(root)'}: value looks like a secret`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => secretPaths(item, `${path}/${index}`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(isSecretKey(key) || looksLikeSecret(key) ? [`${path}/${pointerKey(key)}: secrets must not be stored in a research profile`] : []),
      ...secretPaths(item, `${path}/${pointerKey(key)}`),
    ]);
  }
  return [];
}

/** Returns the problems of a profile's YAML text, as "path: message" strings; empty when valid. */
export function validateProfile(text) {
  if (typeof text !== 'string') return ['(root): expected YAML text'];
  const documents = parseAllDocuments(text, { uniqueKeys: true, stringKeys: true, resolveKnownTags: false, merge: false });
  if (documents.length === 0) {
    return ['(root): the file is empty; a profile needs at least profileVersion'];
  }
  if (documents.length !== 1) {
    return [`(root): expected one YAML document, found ${documents.length}`];
  }
  const [document] = documents;
  if (document.errors.length > 0 || document.warnings.length > 0) {
    return [...document.errors, ...document.warnings].map(yamlProblem);
  }
  if (document.directives.yaml.version !== '1.2') return ['(yaml): profiles require YAML 1.2'];
  let profile;
  try {
    profile = document.toJS({ maxAliasCount: 100 });
  } catch {
    return ['(yaml): cannot resolve aliases safely'];
  }
  const graphProblem = jsonProblem(profile);
  if (graphProblem) return [graphProblem];
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    return ['(root): a profile must be a YAML mapping of keys to values'];
  }

  const problems = [];
  if (!validateSchema(profile)) {
    problems.push(...validateSchema.errors.map(describeSchemaError).filter((problem) => problem !== null));
  }
  const { language, venue } = profile;
  if (typeof language?.primary === 'string' && typeof language.variant === 'string' && !language.variant.toLowerCase().startsWith(`${language.primary.toLowerCase()}-`)) {
    // Do not echo the supplied primary: malformed input could itself contain a credential.
    problems.push('/language/variant: must start with the primary language followed by a hyphen');
  }
  if (Number.isInteger(venue?.wordLimit) && Number.isInteger(venue?.abstractWordLimit) && venue.abstractWordLimit > venue.wordLimit) {
    problems.push('/venue/abstractWordLimit: cannot exceed venue.wordLimit');
  }
  if (typeof venue?.guidelinesCheckedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(venue.guidelinesCheckedOn)) {
    const date = new Date(`${venue.guidelinesCheckedOn}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== venue.guidelinesCheckedOn) {
      problems.push('/venue/guidelinesCheckedOn: must be a valid calendar date');
    }
  }
  if (Array.isArray(profile.terminology?.abbreviations)) {
    const seen = new Set();
    profile.terminology.abbreviations.forEach((entry, index) => {
      if (typeof entry?.abbreviation !== 'string') return;
      if (seen.has(entry.abbreviation)) problems.push(`/terminology/abbreviations/${index}/abbreviation: duplicate abbreviation`);
      seen.add(entry.abbreviation);
    });
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
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      console.error(`${name}: unable to read profile`);
      failures++;
      continue;
    }
    const problems = validateProfile(text);
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
