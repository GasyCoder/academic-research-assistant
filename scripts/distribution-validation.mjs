import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve, relative } from 'node:path';

/** Lightweight local Markdown check, intentionally not an Internet crawler or full renderer. */
export function prose(text) {
  let fence;
  return text.split(/\r?\n/u).map(line => {
    const mark = /^\s{0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (mark && !fence) { fence = mark; return ''; }
    if (fence) { if (mark?.[0] === fence[0] && mark.length >= fence.length) fence = undefined; return ''; }
    return line;
  }).join('\n');
}
export function anchors(text) {
  const result = new Set();
  for (const [, heading] of prose(text).matchAll(/^#{1,6}[ \t]+(.+?)\s*#*$/gmu)) {
    const base = heading.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N} _-]/gu, '').replace(/ /gu, '-');
    let name = base, suffix = 0;
    while (result.has(name)) name = `${base}-${++suffix}`;
    result.add(name);
  }
  return result;
}
export function checkLinks(file, root) {
  const errors = [], text = prose(readFileSync(file, 'utf8'));
  const targets = [...text.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/gu)].map(m => m[1].replace(/^<|>$/gu, ''));
  targets.push(...[...text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gmu)].map(m => m[1]));
  for (const target of targets) {
    if (/^[a-z][a-z\d+.-]*:/iu.test(target) || target.startsWith('//')) continue;
    let path, anchor;
    try { [path, anchor] = target.split('#').map(decodeURIComponent); }
    catch { errors.push(`${relative(root, file)}: invalid link encoding`); continue; }
    const linked = path ? resolve(dirname(file), path) : file;
    if (!existsSync(linked)) errors.push(`${relative(root, file)}: broken link ${target}`);
    else if (anchor && linked.endsWith('.md') && !anchors(readFileSync(linked, 'utf8')).has(anchor))
      errors.push(`${relative(root, file)}: missing anchor ${target}`);
  }
  return errors;
}
export function checkVersions(manifests, plugin) {
  const errors = [], version = manifests.root.version;
  if (!/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/iu.test(version)) errors.push('root version must be semver');
  for (const key of ['languagetool', 'integrations'])
    if (manifests[key].version !== version) errors.push(`${key} version differs from root`);
  if (plugin.version !== version) errors.push('plugin version differs from root');
  if (plugin.name !== 'academic-research-assistant') errors.push('unexpected plugin name');
  if (Object.keys(plugin).some(key => !['name', 'version', 'description'].includes(key))) errors.push('plugin must remain Skills-only without auto-start components');
  for (const [key, manifest] of Object.entries(manifests)) {
    if (manifest.private !== true) errors.push(`${key} must remain private until publication is explicitly approved`);
    if (manifest.engines?.node !== '>=20') errors.push(`${key} engines must match the tested Node floor`);
  }
  // Document Formats deliberately remains an internal library, separately versioned.
  if (!/^\d+\.\d+\.\d+$/u.test(manifests.formats.version)) errors.push('invalid internal formats version');
  return errors;
}
export function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', 'dist', '.cache'].includes(entry.name)) return [];
    if (basename(directory) === 'profiles' && entry.name === 'local') return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') && statSync(path).isFile() ? [path] : [];
  });
}
