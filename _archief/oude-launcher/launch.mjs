/**
 * Eén launcher voor al je webapps in deze map.
 *
 *   node launch.mjs            → toont alle apps, hun poort en of ze draaien
 *   node launch.mjs <naam>     → start die app op zijn eigen poort
 *   node launch.mjs all-static → start álle statische sites onder één server
 *
 * Waarom dit bestaat: je hebt een tiental Node-apps en een handvol statische
 * HTML-sites, elk met een andere manier van starten. Draai je er twee met
 * `npm run dev`, dan vechten ze om poort 3000. Deze launcher geeft elke app een
 * vaste, eigen poort, zodat je er zoveel tegelijk kunt draaien als je wilt.
 *
 * Geen dependencies: puur Node. De statische server zit erin.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Het register. Elke app krijgt één vaste poort, zodat je ze naast elkaar kunt
 * draaien en de URL onthoudt.
 *
 * type:
 *   next    → next dev -p <poort>
 *   vite    → vite --port <poort>
 *   express → node <server>, poort via PORT-env
 *   static  → ingebouwde statische server op <dir>
 *   monorepo→ eigen npm-scripts (superette); alleen een verwijzing
 */
const APPS = [
  // ── Next.js ──────────────────────────────────────────────────────────────
  { key: 'eid-luxe-shop', dir: 'eid-luxe-shop', type: 'next', port: 3001, label: 'Eid Luxe Shop' },
  { key: 'jamal-jamila', dir: 'jamal-jamila', type: 'next', port: 3002, label: 'Jamal & Jamila (webshop)', needs: 'database (Prisma) — sommige pagina\'s falen zonder db:push' },
  { key: 'luxe-store', dir: 'luxe-store', type: 'next', port: 3003, label: 'Luxe Store', needs: 'database (Prisma)' },
  { key: 'noor-tracker', dir: 'noor-tracker', type: 'next', port: 3004, label: 'Noor Tracker' },
  { key: 'printable-generator', dir: 'printable-generator', type: 'next', port: 3005, label: 'Printable Generator' },

  // ── Vite ─────────────────────────────────────────────────────────────────
  { key: 'webshop', dir: 'webshop', type: 'vite', port: 3006, label: 'Webshop' },
  { key: 'resume-roaster', dir: 'resume-roaster', type: 'vite', port: 3007, label: 'Resume Roaster (frontend)', needs: 'de API-kant draait apart: node resume-roaster/server.js' },

  // ── Express ──────────────────────────────────────────────────────────────
  { key: 'marktonderzoek', dir: 'marktonderzoek', type: 'express', entry: 'server.js', port: 3008, label: 'Marktonderzoek (survey)' },

  // ── Statische HTML ───────────────────────────────────────────────────────
  { key: 'brandstofprijzen', dir: 'sites/brandstofprijzen', type: 'static', port: 3011, label: 'Brandstofprijzen' },
  { key: 'salaat', dir: 'Salaat', type: 'static', open: '/salaat-times.html', port: 3012, label: 'Salaat-tijden' },
  { key: 'noor-funnel', dir: 'noor-growth-funnel', type: 'static', port: 3013, label: 'Noor Growth Funnel' },
  { key: 'parking-brussel', dir: 'parking-brussel-helper', type: 'static', port: 3014, label: 'Parking Brussel Helper' },
  { key: 'simple-webapp', dir: 'simple-webapp', type: 'static', port: 3015, label: 'Simple Webapp' },
  { key: 'hikmar', dir: 'Assitant/files (3)', type: 'static', open: '/hikmar_landing.html', port: 3016, label: 'Hikmar landing' },

  // ── Bijzonder ────────────────────────────────────────────────────────────
  {
    key: 'superette',
    dir: 'superette',
    type: 'monorepo',
    port: 3000,
    label: 'Superette (onbemande winkel)',
    needs: 'vier processen — zie de instructie hieronder',
  },
  {
    key: 'noor-app',
    dir: 'noor-app',
    type: 'expo',
    port: 3017,
    label: 'Noor App (Expo / React Native)',
    needs: 'mobiele app; web draait via: cd noor-app && npx expo start --web',
  },
];

const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/** Snelle TCP-check: luistert er iets op deze poort? */
function isPortOpen(port) {
  return new Promise((resolvePort) => {
    const socket = connect({ host: '127.0.0.1', port, timeout: 300 });
    socket.on('connect', () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.on('error', () => resolvePort(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

async function printList() {
  console.log(`\n${BOLD}Al je webapps${RESET}  ${DIM}— node launch.mjs <naam> om er een te starten${RESET}\n`);

  const statuses = await Promise.all(APPS.map((app) => isPortOpen(app.port)));

  const groups = {
    next: 'Next.js', vite: 'Vite', express: 'Express', static: 'Statische HTML', monorepo: 'Bijzonder', expo: 'Bijzonder',
  };
  let lastGroup = null;

  APPS.forEach((app, index) => {
    const group = groups[app.type];
    if (group !== lastGroup) {
      console.log(`${DIM}  ${group}${RESET}`);
      lastGroup = group;
    }

    const running = statuses[index];
    const dot = running ? `${GREEN}●${RESET}` : `${DIM}○${RESET}`;
    const name = app.key.padEnd(20);
    const url = `http://localhost:${app.port}`;
    const state = running ? `${GREEN}draait${RESET}` : `${DIM}gestopt${RESET}`;

    console.log(`  ${dot} ${BOLD}${name}${RESET} ${DIM}${url}${RESET}  ${state}`);
    if (app.needs) console.log(`      ${YELLOW}⚠${RESET} ${DIM}${app.needs}${RESET}`);
  });

  console.log('');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};

/** Serveert één map statisch. Directory-traversal buiten de map wordt geweigerd. */
function startStaticServer(baseDir, port, openPath) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let filePath = resolve(baseDir, '.' + urlPath);

      if (!filePath.startsWith(baseDir)) {
        res.writeHead(403).end('Verboden');
        return;
      }

      let info = await stat(filePath).catch(() => null);
      if (info?.isDirectory()) {
        filePath = join(filePath, 'index.html');
        info = await stat(filePath).catch(() => null);
      }
      if (!info) {
        res.writeHead(404).end('Niet gevonden');
        return;
      }

      res.writeHead(200, { 'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(500).end('Serverfout');
    }
  });

  server.listen(port, () => {
    console.log(`${GREEN}●${RESET} Statische server draait op ${BOLD}http://localhost:${port}${openPath ?? '/'}${RESET}`);
    console.log(`${DIM}  map: ${baseDir}${RESET}`);
    console.log(`${DIM}  Ctrl+C om te stoppen${RESET}\n`);
    void openBrowser(`http://localhost:${port}${openPath ?? '/'}`);
  });
}

/** Start álle statische sites onder één server, met een indexpagina. */
function startAllStatic(port) {
  const staticApps = APPS.filter((app) => app.type === 'static');

  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);

    if (urlPath === '/') {
      const links = staticApps
        .map((app) => `<li><a href="/${app.key}/${(app.open ?? '').replace(/^\//, '')}">${app.label}</a> <code>/${app.key}</code></li>`)
        .join('\n');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset=utf-8><title>Statische sites</title>
<style>body{font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem;background:#0b0b0c;color:#eee}
a{color:#e0a566}li{margin:.6rem 0;line-height:1.6}code{color:#888;font-size:.85em}h1{font-weight:600}</style>
<h1>Statische sites</h1><ul>${links}</ul>`);
      return;
    }

    const match = staticApps.find((app) => urlPath === `/${app.key}` || urlPath.startsWith(`/${app.key}/`));
    if (!match) {
      res.writeHead(404).end('Onbekende site');
      return;
    }

    const baseDir = resolve(ROOT, match.dir);
    const rel = urlPath.slice(`/${match.key}`.length) || '/';
    let filePath = resolve(baseDir, '.' + rel);
    if (!filePath.startsWith(baseDir)) {
      res.writeHead(403).end('Verboden');
      return;
    }

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404).end('Niet gevonden');
      return;
    }

    res.writeHead(200, { 'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    console.log(`\n${GREEN}●${RESET} Alle statische sites op ${BOLD}http://localhost:${port}${RESET}`);
    staticApps.forEach((app) => console.log(`${DIM}  /${app.key}${RESET}  ${app.label}`));
    console.log(`${DIM}\n  Ctrl+C om te stoppen${RESET}\n`);
    void openBrowser(`http://localhost:${port}`);
  });
}

/** Opent de URL in de standaardbrowser (Windows), tenzij LAUNCH_NO_OPEN gezet is. */
function openBrowser(url) {
  if (process.env.LAUNCH_NO_OPEN) return;
  // `start` is een cmd-builtin; de lege "" is de venstertitel.
  spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
}

/** Start een framework-app (next / vite / express) op zijn poort. */
function startFrameworkApp(app) {
  const cwd = resolve(ROOT, app.dir);
  const env = { ...process.env, PORT: String(app.port), BROWSER: 'none' };

  // Windows weigert .cmd-bestanden (npx.cmd) te starten zonder shell, sinds de
  // fix voor CVE-2024-27980. Dus: shell aan. Om dan géén DEP0190-waarschuwing te
  // krijgen, geven we het hele commando als één string mee in plaats van een
  // losse args-array. De poort is een geheel getal uit ons eigen register, dus
  // er valt niets te injecteren.
  let command;

  if (app.type === 'next') {
    command = `npx next dev -p ${app.port}`;
  } else if (app.type === 'vite') {
    command = `npx vite --port ${app.port} --strictPort`;
  } else if (app.type === 'express') {
    // node is een echt uitvoerbaar bestand, geen .cmd — hier is geen shell nodig.
    command = `node ${app.entry ?? 'server.js'}`;
  } else {
    console.error(`Type ${app.type} kan deze launcher niet zelf starten.`);
    process.exit(1);
  }

  console.log(`\n${GREEN}●${RESET} ${BOLD}${app.label}${RESET} start op ${BOLD}http://localhost:${app.port}${RESET}`);
  if (app.needs) console.log(`  ${YELLOW}⚠${RESET} ${app.needs}`);
  console.log(`${DIM}  map: ${app.dir} · Ctrl+C om te stoppen${RESET}\n`);

  const child = spawn(command, { cwd, env, stdio: 'inherit', shell: true });

  // Open de browser zodra de poort luistert (framework-servers hebben even nodig).
  void (async () => {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isPortOpen(app.port)) {
        openBrowser(`http://localhost:${app.port}`);
        return;
      }
    }
  })();

  child.on('exit', (code) => process.exit(code ?? 0));
}

/**
 * "Alles tegelijk" doet op Windows het meest betrouwbaar één ding: verwijzen
 * naar start-all.bat.
 *
 * Waarom niet vanuit deze launcher zelf de vensters openen? Omdat een nieuw
 * terminalvenster starten vanuit Node op Windows door meerdere lagen quoting en
 * PATH-resolutie moet (node → cmd/powershell → start → cmd /k → app), en dat is
 * hier wisselvallig gebleken. Een .bat-bestand draait rechtstreeks in cmd, zonder
 * die tussenlagen — dat werkt wél betrouwbaar. Gebruik dus de batch.
 */
function startAll() {
  const runnable = APPS.filter((app) => ['next', 'vite', 'express'].includes(app.type) && !app.needs);
  const skipped = APPS.filter((app) => app.needs || app.type === 'monorepo' || app.type === 'expo');

  console.log(`\n${BOLD}Alles tegelijk opstarten${RESET}\n`);
  console.log(`  Dubbelklik ${BOLD}start-all.bat${RESET} in deze map,`);
  console.log(`  of draai in een terminal:  ${BOLD}start-all.bat${RESET}\n`);
  console.log(`${DIM}  Dat opent per app een eigen venster:${RESET}`);

  console.log(`  ${GREEN}●${RESET} statische sites          ${DIM}http://localhost:3010${RESET}`);
  for (const app of runnable) {
    console.log(`  ${GREEN}●${RESET} ${app.key.padEnd(24)} ${DIM}http://localhost:${app.port}${RESET}`);
  }

  console.log(`\n${YELLOW}Deze starten apart (ze hebben eerst iets nodig):${RESET}`);
  for (const app of skipped) {
    console.log(`  ${DIM}•${RESET} ${BOLD}${app.key}${RESET} — ${app.needs ?? 'zie LAUNCH.md'}`);
  }
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const arg = process.argv[2];

if (!arg || arg === 'list' || arg === 'ls') {
  await printList();
  process.exit(0);
}

if (arg === 'all') {
  startAll();
} else if (arg === 'all-static') {
  startAllStatic(3010);
} else {
  const app = APPS.find((a) => a.key === arg);

  if (!app) {
    console.error(`\nOnbekende app: "${arg}"\nDraai "node launch.mjs" voor de lijst.\n`);
    process.exit(1);
  }

  if (app.type === 'static') {
    startStaticServer(resolve(ROOT, app.dir), app.port, app.open);
  } else if (app.type === 'monorepo') {
    console.log(`\n${BOLD}${app.label}${RESET} is een monorepo met vier processen. Start in vier terminals:\n`);
    console.log('  cd superette');
    console.log('  npm run dev:db     # database');
    console.log('  npm run dev:gate   # MQTT + deurcontroller');
    console.log('  npm run dev:api    # API op :4000');
    console.log('  npm run dev:pwa    # app op :3000\n');
    console.log(`${DIM}Daarna: http://localhost:3000${RESET}\n`);
  } else if (app.type === 'expo') {
    console.log(`\n${BOLD}${app.label}${RESET} is een Expo-app. Web-versie:\n`);
    console.log('  cd noor-app');
    console.log('  npx expo start --web\n');
  } else {
    startFrameworkApp(app);
  }
}
