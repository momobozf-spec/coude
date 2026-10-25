/**
 * Nachtelijke prijsupdate voor Superette (Windows Taakplanner start dit elke nacht).
 *
 *   node lokaal/nachtelijke-update.mjs
 *
 * 1. Start de lokale database als die nog niet draait (en stopt ze daarna weer).
 * 2. Draait `npm run weekly` in superette-pro: Delhaize, ALDI en Lidl scrapen
 *    (rustig, volgens robots.txt), daarna sync naar de database en het matchrapport.
 * 3. Schrijft alles naar superette-pro/apps/api/data/logs/update-JJJJ-MM-DD.log.
 *
 * Een keten die faalt of blokkeert laat zijn vorige bestand staan; de rest gaat door.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb, PG } from './db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const superette = path.resolve(here, '..', 'superette-pro');
const logDir = path.join(superette, 'apps', 'api', 'data', 'logs');
mkdirSync(logDir, { recursive: true });
const day = new Date().toISOString().slice(0, 10);
const logPath = path.join(logDir, `update-${day}.log`);
const log = openSync(logPath, 'a');
const note = (text) => writeSync(log, `[${new Date().toISOString()}] ${text}\n`);

let db;
let code = 1;
try {
  note('Nachtelijke update gestart.');
  db = await startDb();
  note(db.reused ? 'Database draaide al.' : 'Database gestart.');

  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://${PG.user}:${PG.password}@${PG.host}:${PG.port}/superette?schema=public`,
    SCRAPE_CONTACT: process.env.SCRAPE_CONTACT || 'momobozf@gmail.com',
  };
  const result = spawnSync('npm', ['run', 'weekly'], {
    cwd: superette,
    env,
    shell: process.platform === 'win32',
    stdio: ['ignore', log, log],
  });
  code = result.status ?? 1;
  note(`Update klaar met code ${code}.`);
} catch (error) {
  note(`Fout: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (db && !db.reused) {
    await db.stop();
    note('Database weer gestopt.');
  }
  closeSync(log);
}
process.exit(code);
