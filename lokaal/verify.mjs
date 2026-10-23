// Controleert per app: schone installatie, prisma generate, typecheck, lint, tests en build.
// Gebruik: node lokaal/verify.mjs [app ...]   (zonder argumenten: alle GO-apps)
// Resultaat: lokaal/verify-resultaat.json + samenvatting in de console.
// Raakt geen .env-bestanden of databases aan; tests die een database nodig hebben horen bij test:integration.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const coude = path.resolve(here, '..');
const isWin = process.platform === 'win32';

const GO_APPS = [
  'ketelcheck', 'marhaba-consulting', 'noor-growth-funnel', 'kleine-qamar',
  'resume-roaster', 'overnamemarkt', 'tenderkompas', 'rentguard',
  'immoradar-pro', 'layali-pro', 'printable-generator', 'zakat-platform-pro',
  'muslim-life-pro/muslim-life-pro',
];

// Alleen voor de build: neutrale waarden zodat modules kunnen laden. Nooit echte sleutels.
const BUILD_ENV = {
  NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: 'postgresql://build:build@localhost:5432/build',
  AUTH_SECRET: 'build-only-secret-build-only-secret-0000',
  NEXTAUTH_SECRET: 'build-only-secret-build-only-secret-0000',
  BETTER_AUTH_SECRET: 'build-only-secret-build-only-secret-0000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'build-only',
};

const apps = process.argv.slice(2).length ? process.argv.slice(2) : GO_APPS;
const results = {};

function run(cwd, argv, extraEnv = {}) {
  const t0 = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, shell: isWin, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', ...extraEnv },
  });
  const out = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/);
  return { ok: r.status === 0, code: r.status, sec: Math.round((Date.now() - t0) / 1000), tail: out.slice(-25).join('\n') };
}

for (const app of apps) {
  const dir = path.join(coude, app);
  const pkgPath = path.join(dir, 'package.json');
  results[app] = {};
  if (!existsSync(pkgPath)) { results[app].skip = 'geen package.json'; continue; }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const hasDeps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }).length > 0;
  console.log(`\n=== ${app}`);
  const steps = [];
  if (hasDeps) steps.push(['install', existsSync(path.join(dir, 'package-lock.json')) ? ['npm', 'ci', '--no-audit', '--no-fund'] : ['npm', 'install', '--no-audit', '--no-fund']]);
  if (existsSync(path.join(dir, 'prisma', 'schema.prisma'))) steps.push(['prisma', ['npx', 'prisma', 'generate']]);
  for (const s of ['typecheck', 'lint', 'test']) if (scripts[s]) steps.push([s, ['npm', 'run', s]]);
  if (scripts.build) steps.push(['build', ['npm', 'run', 'build'], BUILD_ENV]);
  if (hasDeps) steps.push(['audit', ['npm', 'audit', '--omit=dev', '--audit-level=high']]);
  for (const [name, argv, env] of steps) {
    process.stdout.write(`  ${name} ... `);
    const r = run(dir, argv, env);
    results[app][name] = r;
    console.log(r.ok ? `OK (${r.sec}s)` : `FOUT (code ${r.code}, ${r.sec}s)`);
    if (!r.ok && name === 'install') break;
  }
  writeFileSync(path.join(here, 'verify-resultaat.json'), JSON.stringify(results, null, 2));
}

console.log('\n=== Samenvatting');
for (const [app, r] of Object.entries(results)) {
  const parts = Object.entries(r).filter(([k]) => k !== 'skip').map(([k, v]) => `${k}:${v.ok ? 'ok' : 'FOUT'}`);
  console.log(`${app.padEnd(34)} ${r.skip || parts.join('  ')}`);
}
