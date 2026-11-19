// Verifies that every literal passed to t()/translate() in the active UI has a Hebrew translation,
// and that no translation call uses a non-literal key. Exit code 1 on problems.
// Usage: npm run i18n:check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const LEGACY = ['components', 'pages', 'services', 'types', 'routes', 'auth', 'config'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return dir === root && LEGACY.includes(entry.name) ? [] : walk(full);
    return /\.(tsx?|ts)$/.test(entry.name) && !full.includes(`${path.sep}i18n${path.sep}`) ? [full] : [];
  });
}

const unquote = (raw) => raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
const literal = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;
const call = new RegExp(String.raw`\b(?:t|translate)\(\s*` + literal, 'g');
const dynamic = /\b(?:t|translate)\(\s*[`a-zA-Z_]/g;

const used = new Map();
const problems = [];
for (const file of walk(root)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(call)) {
    const key = unquote(match[1]);
    if (!used.has(key)) used.set(key, path.relative(root, file));
  }
  for (const match of source.matchAll(dynamic)) {
    const before = source.slice(Math.max(0, match.index - 20), match.index);
    if (/function |\.$|new $/.test(before)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    problems.push(`${path.relative(root, file)}:${line} translation key is not a string literal`);
  }
}

const heSource = fs.readFileSync(path.join(root, 'i18n', 'he.ts'), 'utf8');
const heKeys = new Set([...heSource.matchAll(new RegExp(String.raw`^\s*` + literal + String.raw`\s*:`, 'gm'))].map((match) => unquote(match[1])));

const missing = [...used.entries()].filter(([key]) => !heKeys.has(key));
// Entries after the 'Server messages' marker translate text the API writes; they are matched at
// runtime (translateServerMessage) rather than by a literal in the code, so they never count as unused.
const serverBlock = heSource.indexOf('// Server messages');
const clientSource = serverBlock >= 0 ? heSource.slice(0, serverBlock) : heSource;
const clientKeys = new Set([...clientSource.matchAll(new RegExp(String.raw`^s*` + literal + String.raw`s*:`, 'gm'))].map((match) => unquote(match[1])));
const unused = [...clientKeys].filter((key) => !used.has(key));

for (const [key, file] of missing) problems.push(`missing Hebrew: ${JSON.stringify(key)} (${file})`);
console.log(`i18n: ${used.size} keys used, ${heKeys.size} Hebrew entries, ${missing.length} missing, ${unused.length} unused.`);
if (unused.length) console.log('unused Hebrew keys:', unused.slice(0, 20).map((key) => JSON.stringify(key)).join(', '));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
