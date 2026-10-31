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
import { describeSchemaError, parseProfileDocument, secretPaths } from './profile-validation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schemas', 'research-profile.schema.json'), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

/** Returns the problems of a profile's YAML text, as "path: message" strings; empty when valid. */
export function validateProfile(text) {
  const parsed = parseProfileDocument(text);
  if (parsed.problems.length > 0) return parsed.problems;
  const { profile } = parsed;

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
