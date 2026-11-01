import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks, checkVersions, checkMarketplace, markdownFiles } from './distribution-validation.mjs';
import { validateProfile } from './validate-profiles.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const errors = checkVersions({ root: json('package.json'), languagetool: json('packages/languagetool-mcp/package.json'),
  integrations: json('packages/research-integrations-mcp/package.json'), formats: json('packages/document-formats/package.json') },
json('.claude-plugin/plugin.json'));
errors.push(...checkMarketplace(json('.claude-plugin/marketplace.json'), json('.claude-plugin/plugin.json')));
for (const name of ['academic-writing', 'scientific-review', 'citation-integrity', 'research-profile']) {
  // Root source ./ must retain the four default Skills in every clone/install.
  if (!existsSync(resolve(root, 'skills', name, 'SKILL.md'))) errors.push(`missing marketplace Skill: ${name}`);
}
const license = readFileSync(resolve(root, 'LICENSE'), 'utf8');
for (const directory of ['languagetool-mcp', 'document-formats', 'research-integrations-mcp']) {
  if (readFileSync(resolve(root, 'packages', directory, 'LICENSE'), 'utf8') !== license)
    errors.push(`${directory}: packaged LICENSE must match the repository LICENSE`);
}
const files = markdownFiles(root).filter(f => !f.startsWith(resolve(root, 'profiles/local') + '/'));
for (const file of files) errors.push(...checkLinks(file, root));
for (const name of ['minimal', 'complete']) {
  const result = validateProfile(readFileSync(resolve(root, `examples/profiles/${name}.yaml`), 'utf8'));
  errors.push(...result.map(problem => `example ${name}: ${problem}`));
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Distribution versions/plugin/marketplace, ${files.length} Markdown files and 2 synthetic profiles valid`);
