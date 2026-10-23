// Lokale PostgreSQL zonder installatie of adminrechten (embedded-postgres).
// Gegevens blijven bewaard in lokaal/.pgdata tussen herstarts.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const PG = { host: 'localhost', port: 54329, user: 'postgres', password: 'lokaal' };
export const DATABASES = ['ritna', 'tenderkompas'];
export const url = (db) => `postgres://${PG.user}:${PG.password}@${PG.host}:${PG.port}/${db}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '.pgdata');

async function alreadyRunning() {
  const { default: pgLib } = await import('pg');
  const c = new pgLib.Client({ connectionString: url('postgres'), connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.end(); return true; } catch { return false; }
}

export async function startDb() {
  // Venster hard gesloten bij een vorige run? Dan draait postgres soms nog: gewoon hergebruiken.
  if (await alreadyRunning()) {
    console.log(`[db] PostgreSQL draaide nog op poort ${PG.port}, wordt hergebruikt`);
    return { stop: async () => {} , reused: true };
  }
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG.user,
    password: PG.password,
    port: PG.port,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error('[db]', String(e).trim()),
  });
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('[db] eerste keer: database aanmaken...');
    await pg.initialise();
  }
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  for (const name of DATABASES) {
    const r = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (!r.rowCount) {
      await client.query(`create database ${name}`);
      console.log(`[db] database ${name} aangemaakt`);
    }
  }
  await client.end();
  console.log(`[db] PostgreSQL draait op poort ${PG.port}`);
  return pg;
}

// Los starten: node db.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pg = await startDb();
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
