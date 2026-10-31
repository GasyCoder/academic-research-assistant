#!/usr/bin/env node
/*
 * Validates the Skills under skills/ without dependencies:
 * - every skill directory has a SKILL.md;
 * - a SKILL.md either is an explicit placeholder or starts with frontmatter whose `name` matches
 *   its directory and whose `description` says when to use it;
 * - relative Markdown links and their #anchors resolve;
 * - no file holds researcher-specific content (Skills must stay generic).
 * Usage: node scripts/validate-skills.mjs [skills directory]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = resolve(process.argv[2] ?? join(root, 'skills'));

/** Frontmatter keys of the Agent Skills format; anything else is probably a typo. */
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata']);
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Researcher, institution or place names that must never appear in reusable Skills. */
const RESEARCHER_SPECIFIC = /\b(florent|bezara|umg|madagascar|mahajanga|antananarivo)\b/i;

const errors = [];
const fail = (file, message) => errors.push(`${relative(root, file)}: ${message}`);

function filesUnder(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Checks the repository's single-line `key: value` subset, not general YAML. */
function frontmatter(file, text) {
  text = text.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) {
    return null;
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    fail(file, 'frontmatter is not closed by a --- line');
    return {};
  }
  const fields = {};
  for (const line of text.slice(4, end).split('\n')) {
    const match = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (!match) {
      fail(file, `unsupported frontmatter line: ${line}`);
      continue;
    }
    const key = match[1];
    const value = match[2].trim();
    if (Object.hasOwn(fields, key)) {
      fail(file, `duplicate frontmatter key "${key}"`);
      continue;
    }
    if (!/^["']/.test(value) && /:\s/.test(value)) {
      fail(file, `unsupported frontmatter value for "${key}": an unquoted colon followed by whitespace is invalid YAML`);
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

/** GitHub-style heading anchors of a Markdown file. */
function anchors(text) {
  const found = new Set();
  for (const [, heading] of text.matchAll(/^#{1,6}[ \t]+(.+)$/gm)) {
    const base = heading.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N} -]/gu, '').replace(/ /g, '-');
    let anchor = base;
    let suffix = 0;
    while (found.has(anchor)) {
      anchor = `${base}-${++suffix}`;
    }
    found.add(anchor);
  }
  return found;
}

function checkSkill(directory) {
  const file = join(directory, 'SKILL.md');
  if (!existsSync(file)) {
    fail(directory, 'missing SKILL.md');
    return;
  }
  const text = readFileSync(file, 'utf8');
  const fields = frontmatter(file, text);
  if (fields === null) {
    if (!/placeholder/i.test(text)) {
      fail(file, 'no frontmatter: a SKILL.md must start with --- name/description --- unless it is a placeholder');
    }
    return;
  }
  const name = directory.split(/[\\/]/).at(-1);
  for (const key of Object.keys(fields)) {
    if (!ALLOWED_KEYS.has(key)) {
      fail(file, `unknown frontmatter key "${key}"`);
    }
  }
  if (fields.name !== name) {
    fail(file, `name "${fields.name ?? ''}" must equal the directory name "${name}"`);
  }
  if (!NAME_PATTERN.test(fields.name ?? '') || fields.name.length > 64) {
    fail(file, 'name must be lowercase words joined by hyphens, at most 64 characters');
  }
  const description = fields.description ?? '';
  if (description.length < 40 || description.length > 1024) {
    fail(file, `description must say what the Skill does and when to use it (40-1024 characters, got ${description.length})`);
  }
  if (/[<>]/.test(description)) {
    fail(file, 'description must not contain < or >');
  }
  if (fields.compatibility !== undefined && (fields.compatibility.length === 0 || fields.compatibility.length > 500)) {
    fail(file, 'compatibility must contain 1-500 characters');
  }
}

function checkFile(file) {
  const text = readFileSync(file, 'utf8');
  const specific = RESEARCHER_SPECIFIC.exec(text);
  if (specific) {
    fail(file, `researcher-specific term "${specific[0]}"`);
  }
  if (!file.endsWith('.md')) {
    return;
  }
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) {
      continue;
    }
    const [path, anchor] = target.split('#');
    const linked = path === '' ? file : resolve(dirname(file), path);
    if (!existsSync(linked)) {
      fail(file, `broken link ${target}`);
    } else if (anchor && linked.endsWith('.md') && !anchors(readFileSync(linked, 'utf8')).has(anchor)) {
      fail(file, `missing anchor #${anchor} in ${target}`);
    }
  }
}

if (!existsSync(skillsDir)) {
  console.error(`No skills directory at ${skillsDir}`);
  process.exit(1);
}
const skillDirectories = readdirSync(skillsDir)
  .map((entry) => join(skillsDir, entry))
  .filter((path) => statSync(path).isDirectory());
skillDirectories.forEach(checkSkill);
filesUnder(skillsDir).forEach(checkFile);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(`${errors.length} problem(s) in ${relative(root, skillsDir) || '.'}`);
  process.exit(1);
}
console.log(`${skillDirectories.length} skills valid in ${relative(root, skillsDir) || '.'}`);
