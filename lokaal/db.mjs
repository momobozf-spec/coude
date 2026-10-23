// Lokale PostgreSQL zonder installatie of adminrechten (embedded-postgres).
// Gegevens blijven bewaard in lokaal/.pgdata tussen herstarts.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const PG = { host: 'localhost', port: 54329, user: 'postgres', password: 'lokaal' };
export const DATABASES = ['ritna', 'tenderkompas', 'tenderkompas_test'];
export const url = (db) => `postgres://${PG.user}:${PG.password}@${PG.host}:${PG.port}/${db}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '.pgdata');

async function alreadyRunning() {
  const { default: pgLib } = await import('pg');
  const c = new pgLib.Client({ connectionString: url('postgres'), connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.end(); return true; } catch { return false; }
}

async function ensureDatabases(client) {
  const enc = await client.query("select datname from pg_database where datname = any($1) and pg_encoding_to_char(encoding) <> 'UTF8'", [DATABASES]);
  for (const { datname } of enc.rows) console.warn(`[db] let op: database ${datname} is niet UTF-8 (oude lokale aanmaak). Arabische tekens of emoji kunnen falen.`);
  for (const name of DATABASES) {
    const r = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (!r.rowCount) {
      // UTF-8 expliciet: de Windows-standaard (WIN1252) kan geen Arabisch of emoji opslaan.
      await client.query(`create database ${name} encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`);
      console.log(`[db] database ${name} aangemaakt`);
    }
  }
}

export async function startDb() {
  // Venster hard gesloten bij een vorige run? Dan draait postgres soms nog: gewoon hergebruiken.
  if (await alreadyRunning()) {
    console.log(`[db] PostgreSQL draaide nog op poort ${PG.port}, wordt hergebruikt`);
    const { default: pgLib } = await import('pg');
    const c = new pgLib.Client({ connectionString: url('postgres') });
    await c.connect();
    await ensureDatabases(c);
    await c.end();
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
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('[db] eerste keer: database aanmaken...');
    await pg.initialise();
  }
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  await ensureDatabases(client);
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
