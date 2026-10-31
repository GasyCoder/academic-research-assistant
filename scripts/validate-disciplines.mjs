#!/usr/bin/env node
// Validate individual discipline profiles and the catalog's explicit selection names.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { describeSchemaError, parseProfileDocument, secretPaths } from './profile-validation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schemas/discipline-profile.schema.json'), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

/** Normalisation for explicit aliases only, never manuscript classification or fuzzy matching. */
const selectionName = (value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();

function inspectProfile(text) {
  const parsed = parseProfileDocument(text, 'disciplineProfileVersion');
  if (parsed.problems.length > 0) return parsed;
  const { profile, problems } = parsed;
  if (!validateSchema(profile)) {
    problems.push(...validateSchema.errors.map(describeSchemaError).filter((problem) => problem !== null));
  }
  problems.push(...secretPaths(profile, '', 'discipline profile'));
  return parsed;
}

/** Single-file validation includes duplicate aliases and aliases redundant with the id. */
export function validateDisciplineProfile(text) {
  return validateDisciplineCatalog([text])[0];
}

/** One diagnostic list per supplied YAML text; errors never echo supplied identity values. */
export function validateDisciplineCatalog(texts) {
  if (!Array.isArray(texts)) throw new TypeError('expected an array of YAML texts');
  const inspected = texts.map(inspectProfile);
  const owners = new Map();
  inspected.forEach(({ profile, problems }, fileIndex) => {
    // Invalid documents cannot enter the selection namespace.
    if (problems.length > 0) return;
    const entries = [['/id', profile.id], ...(profile.aliases ?? []).map((value, i) => [`/aliases/${i}`, value])];
    for (const [path, value] of entries) {
      const name = selectionName(value);
      const previous = owners.get(name);
      if (previous) {
        const message = `${path}: duplicate id or alias; conflicts with input ${previous.fileIndex + 1} ${previous.path}`;
        problems.push(message);
        if (previous.fileIndex !== fileIndex) {
          inspected[previous.fileIndex].problems.push(`${previous.path}: duplicate id or alias; conflicts with input ${fileIndex + 1} ${path}`);
        }
      } else {
        owners.set(name, { fileIndex, path });
      }
    }
  });
  return inspected.map(({ problems }) => problems);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let targets;
  try {
    targets = process.argv.length > 2 ? process.argv.slice(2).map((file) => resolve(file))
      : readdirSync(join(root, 'profiles/disciplines'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
        .map((entry) => join(root, 'profiles/disciplines', entry.name)).sort();
  } catch {
    console.error('unable to read discipline profile directory');
    process.exit(1);
  }
  if (targets.length === 0) {
    console.error('no discipline profile files found');
    process.exit(1);
  }
  const readable = [];
  let failures = 0;
  for (const file of targets) {
    try {
      readable.push({ file, text: readFileSync(file, 'utf8') });
    } catch {
      console.error(`${relative(process.cwd(), file)}: unable to read discipline profile`);
      failures++;
    }
  }
  const results = validateDisciplineCatalog(readable.map(({ text }) => text));
  readable.forEach(({ file }, index) => {
    const name = relative(process.cwd(), file) || file;
    if (results[index].length === 0) {
      console.log(`${name}: valid`);
    } else {
      failures++;
      results[index].forEach((problem) => console.error(`${name}: ${problem}`));
    }
  });
  if (failures > 0) {
    console.error(`${failures} invalid or unreadable discipline profile(s)`);
    process.exit(1);
  }
}
