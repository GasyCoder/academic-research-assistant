// Shared YAML and diagnostic safeguards for research and discipline profiles.
import { parseAllDocuments } from 'yaml';

/** Keys that would hold credentials. Neither profile format needs them. */
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

export function describeSchemaError(error) {
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
export function secretPaths(value, path = '', kind = 'research profile') {
  if (typeof value === 'string') {
    return looksLikeSecret(value) ? [`${path || '(root)'}: value looks like a secret`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => secretPaths(item, `${path}/${index}`, kind));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(isSecretKey(key) || looksLikeSecret(key) ? [`${path}/${pointerKey(key)}: secrets must not be stored in a ${kind}`] : []),
      ...secretPaths(item, `${path}/${pointerKey(key)}`, kind),
    ]);
  }
  return [];
}

/** Parse one safe YAML 1.2 mapping; diagnostics never quote supplied values. */
export function parseProfileDocument(text, versionField = 'profileVersion') {
  if (typeof text !== 'string') return { problems: ['(root): expected YAML text'] };
  const documents = parseAllDocuments(text, { uniqueKeys: true, stringKeys: true, resolveKnownTags: false, merge: false });
  if (documents.length === 0) {
    return { problems: [`(root): the file is empty; a profile needs at least ${versionField}`] };
  }
  if (documents.length !== 1) {
    return { problems: [`(root): expected one YAML document, found ${documents.length}`] };
  }
  const [document] = documents;
  if (document.errors.length > 0 || document.warnings.length > 0) {
    return { problems: [...document.errors, ...document.warnings].map(yamlProblem) };
  }
  if (document.directives.yaml.version !== '1.2') return { problems: ['(yaml): profiles require YAML 1.2'] };
  let profile;
  try {
    profile = document.toJS({ maxAliasCount: 100 });
  } catch {
    return { problems: ['(yaml): cannot resolve aliases safely'] };
  }
  const graphProblem = jsonProblem(profile);
  if (graphProblem) return { problems: [graphProblem] };
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    return { problems: ['(root): a profile must be a YAML mapping of keys to values'] };
  }

  return { profile, problems: [] };
}
