/**
 * Controleert de gebouwde browserbundel van de Superette-app op geheimen en
 * op dingen die er niet in horen.
 *
 *   npm run build -w @superette/web
 *   node scripts/check-bundle-secrets.mjs            # exit 1 bij een treffer
 *
 * Doorzoekt `apps/superette-web/.next/static` (alles wat de browser kan
 * ophalen) op sleutelnamen, connection strings, Bearer/JWT-patronen, de
 * jobsleutelheader en localStorage-gebruik voor tokens. Meldt daarnaast welke
 * NEXT_PUBLIC_-waarden in de bundel zitten, zodat je ziet wat publiek is.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const staticDir = resolve(root, 'apps', 'superette-web', '.next', 'static');

const FORBIDDEN = [
  { name: 'jobsleutel (naam of header)', pattern: /COMPARE_JOB_KEY|x-job-key/i },
  { name: 'JWT_SECRET', pattern: /JWT_SECRET/ },
  { name: 'databaseverbinding', pattern: /postgres(ql)?:\/\/[^\s"']+/i },
  { name: 'DATABASE_URL', pattern: /DATABASE_URL/ },
  { name: 'e-mail-API-sleutel', pattern: /EMAIL_API_KEY|re_[A-Za-z0-9]{20,}/ },
  { name: 'Mollie-sleutel', pattern: /\b(live|test)_[A-Za-z0-9]{25,}\b/ },
  { name: 'Ed25519-privésleutel (JWK met d)', pattern: /"kty"\s*:\s*"OKP"[^}]*"d"\s*:/ },
  { name: 'ingebakken JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'token in localStorage', pattern: /localStorage\.(set|get)Item\(\s*["'`][^"'`]*(token|jwt|access|refresh)[^"'`]*["'`]/i },
  { name: 'Authorization: Bearer in de bundel', pattern: /["'`]Bearer\s+[A-Za-z0-9._-]{20,}/ },
  { name: 'dev-scanner-sleutel', pattern: /NEXT_PUBLIC_DEV_DEVICE_KEY/ },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|css|json|txt|map|html)$/.test(entry)) out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(staticDir);
} catch {
  console.error(`Geen build gevonden in ${staticDir}. Bouw eerst: npm run build -w @superette/web`);
  process.exit(2);
}

const hits = [];
const publicValues = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const { name, pattern } of FORBIDDEN) {
    const match = pattern.exec(text);
    if (match) hits.push({ file: relative(root, file), name, sample: match[0].slice(0, 60) });
  }
  for (const match of text.matchAll(/https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/api\/v1/g)) {
    publicValues.set(match[0], (publicValues.get(match[0]) ?? 0) + 1);
  }
  if (/\.map$/.test(file)) hits.push({ file: relative(root, file), name: 'sourcemap in de bundel', sample: '' });
}

console.log(`\nBundelcontrole: ${files.length} bestanden in ${relative(root, staticDir)}`);
if (publicValues.size > 0) {
  console.log('Publieke API-URL(s) in de bundel (verwacht, NEXT_PUBLIC_API_URL):');
  for (const [value, count] of publicValues) console.log(`  · ${value} (${count}×)`);
}
if (hits.length === 0) {
  console.log('✓ Geen geheimen, tokens, sourcemaps of localStorage-tokens gevonden.\n');
  process.exit(0);
}
console.log(`✗ ${hits.length} treffer(s):`);
for (const hit of hits) console.log(`  · ${hit.name} in ${hit.file}${hit.sample ? ` — "${hit.sample}"` : ''}`);
console.log('');
process.exit(1);
