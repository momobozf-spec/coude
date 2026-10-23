// Start alle coude-projecten van 22-23 okt lokaal en opent de startpagina.
// Gebruik: dubbelklik start-lokaal.cmd in de coude-map (of: cd lokaal && npm start).
// Stoppen: sluit het venster of druk Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb, url as dbUrl } from './db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const coude = path.resolve(here, '..');
const isWin = process.platform === 'win32';
const START_PORT = 4000;

const RITNA_PW = 'ritna-demo-2026';
const TK_PW = 'tenderkompas-demo-2026';

export const APPS = [
  {
    key: 'ritna', name: 'Ritna', port: 4100, dir: 'ritna', health: '/health',
    env: { DATABASE_URL: dbUrl('ritna'), JWT_SECRET: 'lokaal-ritna-ontwikkelsleutel-niet-voor-productie', SEED_PASSWORD: RITNA_PW, PORT: '4100' },
    prepare: (env) => {
      if (!existsSync(path.join(coude, 'ritna/packages/core/dist/index.js'))) step('ritna', 'kern bouwen', ['npm', 'run', 'build', '-w', '@ritna/core'], 'ritna', env);
      step('ritna', 'demo-accounts', ['npm', 'run', 'db:seed'], 'ritna', env);
    },
    cmd: ['node', 'node_modules/tsx/dist/cli.mjs', 'apps/api/src/server.ts'],
  },
  {
    key: 'tenderkompas', name: 'TenderKompas IT', port: 4200, dir: 'tenderkompas', health: '/login',
    env: { DATABASE_URL: dbUrl('tenderkompas'), BETTER_AUTH_SECRET: 'lokaal-tenderkompas-sleutel-niet-voor-productie', BETTER_AUTH_URL: 'http://localhost:4200', ALLOW_DEMO_DATA: 'true', DEMO_PASSWORD: TK_PW, STORAGE_DIR: './storage', NEXT_TELEMETRY_DISABLED: '1' },
    prepare: (env) => {
      step('tenderkompas', 'database bijwerken', ['npm', 'run', 'db:migrate'], 'tenderkompas', env);
      step('tenderkompas', 'demo-gegevens', ['npm', 'run', 'demo:seed'], 'tenderkompas', env);
    },
    cmd: ['node', 'node_modules/next/dist/bin/next', 'dev', '-p', '4200'],
  },
  {
    key: 'ketelcheck', name: 'KetelCheck', port: 4300, dir: 'ketelcheck', health: '/',
    env: { PORT: '4300' }, noInstall: true,
    cmd: ['node', 'lokaal/server.cjs'],
  },
  {
    key: 'overnamemarkt', name: 'Overnamemarkt', port: 4400, dir: 'overnamemarkt', health: '/',
    env: { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: 'http://localhost:4400' },
    // Heeft een Supabase-project nodig; start enkel als overnamemarkt/.env.local bestaat.
    enabled: () => existsSync(path.join(coude, 'overnamemarkt/.env.local')),
    cmd: ['node', 'node_modules/next/dist/bin/next', 'dev', '-p', '4400'],
  },
];

const children = [];
const log = (tag, msg) => console.log(`[${tag}] ${msg}`);

function step(tag, label, argv, dir, env) {
  log(tag, label + '...');
  const r = spawnSync(argv[0], argv.slice(1), { cwd: path.join(coude, dir), env: { ...process.env, ...env }, stdio: 'pipe', shell: isWin, encoding: 'utf8' });
  if (r.status !== 0) {
    log(tag, `${label} MISLUKT:\n${(r.stdout || '') + (r.stderr || '')}`.trim());
    throw new Error(`${tag}: ${label} mislukt`);
  }
}

function ensureInstalled(app) {
  if (app.noInstall) return;
  if (existsSync(path.join(coude, app.dir, 'node_modules'))) return;
  log(app.key, 'eerste keer: pakketten installeren (kan enkele minuten duren)...');
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: path.join(coude, app.dir), stdio: 'inherit', shell: isWin });
  if (r.status !== 0) throw new Error(`${app.key}: npm ci mislukt`);
}

function launch(app) {
  const child = spawn(app.cmd[0], app.cmd.slice(1), { cwd: path.join(coude, app.dir), env: { ...process.env, ...app.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const tagged = (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach((l) => {
    // Ritna logt JSON per request: enkel fouten tonen.
    if (app.key === 'ritna' && l.startsWith('{') && !/"level":(50|60)/.test(l)) return;
    console.log(`[${app.key}] ${l}`);
  });
  child.stdout.on('data', tagged);
  child.stderr.on('data', tagged);
  child.on('exit', (code) => log(app.key, `gestopt (code ${code})`));
  children.push(child);
}

// ---------------------------------------------------------------- startpagina + statische projecten
const STATIC = { '/pompkompas/': 'pompkompas', '/kleine-qamar/': 'kleine-qamar', '/saas-overdracht/': 'saas-overdracht', '/platformideeen/': 'platformideeen' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function probe(app) {
  if (app.enabled && !app.enabled()) return 'uit';
  try {
    const r = await fetch(`http://localhost:${app.port}${app.health}`, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
    return r.status < 500 ? 'draait' : 'fout';
  } catch { return 'start op'; }
}

function startPage() {
  http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${START_PORT}`);
    if (u.pathname === '/status') {
      const out = {};
      for (const a of APPS) out[a.key] = await probe(a);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(out));
    }
    if (u.pathname === '/' || u.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      return res.end(readFileSync(path.join(here, 'startpagina.html')));
    }
    const prefix = Object.keys(STATIC).find((p) => u.pathname.startsWith(p));
    if (prefix) {
      let rel = decodeURIComponent(u.pathname.slice(prefix.length));
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const base = path.join(coude, STATIC[prefix]);
      const file = path.normalize(path.join(base, rel));
      if (file.startsWith(base) && existsSync(file) && statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        return createReadStream(file).pipe(res);
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Niet gevonden');
  }).listen(START_PORT, () => log('start', `startpagina op http://localhost:${START_PORT}`));
}

function openBrowser(u) {
  const cmd = isWin ? ['cmd', ['/c', 'start', '""', u]] : process.platform === 'darwin' ? ['open', [u]] : ['xdg-open', [u]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch {}
}

// ---------------------------------------------------------------- main
let pg;
async function shutdown() {
  log('start', 'alles stoppen...');
  for (const c of children) {
    try { isWin ? spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' }) : c.kill('SIGTERM'); } catch {}
  }
  try { await pg?.stop(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  pg = await startDb();
  startPage();
  for (const app of APPS) {
    if (app.enabled && !app.enabled()) { log(app.key, 'overgeslagen (zie startpagina)'); continue; }
    try {
      ensureInstalled(app);
      app.prepare?.(app.env);
      launch(app);
      log(app.key, `start op http://localhost:${app.port}`);
    } catch (e) {
      log(app.key, `kon niet starten: ${e.message}`);
    }
  }
  if (!process.argv.includes('--no-browser')) openBrowser(`http://localhost:${START_PORT}`);
  log('start', 'Klaar. Laat dit venster open; sluit het of druk Ctrl+C om alles te stoppen.');
} catch (e) {
  console.error(e);
  await shutdown();
}
