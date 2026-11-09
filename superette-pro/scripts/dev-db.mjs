/**
 * Start een lokale Postgres zonder Docker.
 *
 *   npm run dev:db
 *
 * Draait een echte PostgreSQL-server (geen in-memory nabootsing), zodat de raw
 * SQL in `GateService` — `currentOccupancy < maxOccupancy`, `GREATEST(…, 0)` —
 * ook lokaal exact doet wat hij in productie doet.
 *
 * In productie draai je gewoon `docker compose up -d` of een beheerde Postgres.
 *
 * Staat de repository in een gesynchroniseerde map (OneDrive, Dropbox), zet de
 * datadirectory dan buiten die map: de synchronisatieclient maakt
 * tabelbestanden tijdelijk onleesbaar ("could not read blocks … Invalid
 * argument") en Postgres blijft daar tot een minuut op wachten.
 *
 *   DEV_DB_DIR=%LOCALAPPDATA%\superette-pgdata DEV_DB_PORT=5432 npm run dev:db
 */
import EmbeddedPostgres from 'embedded-postgres';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const databaseDir = process.env.DEV_DB_DIR ? resolve(process.env.DEV_DB_DIR) : resolve(here, '..', '.pgdata');
const port = Number(process.env.DEV_DB_PORT ?? 5432);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'superette',
  password: 'superette',
  port,
  persistent: true,
});

const alreadyInitialised = process.argv.includes('--no-init');

if (!alreadyInitialised) {
  console.log(`Initialiseren van datadirectory in ${databaseDir} …`);
  await pg.initialise().catch((error) => {
    if (String(error).includes('not empty')) {
      console.log('Datadirectory bestaat al — overslaan.');
      return;
    }
    throw error;
  });
}

await pg.start();
console.log(`PostgreSQL draait op localhost:${port} (data: ${databaseDir})`);

await pg.createDatabase('superette').catch((error) => {
  if (String(error).includes('already exists')) {
    console.log('Database `superette` bestaat al.');
    return;
  }
  throw error;
});

console.log('Klaar. Druk Ctrl+C om te stoppen.');

const shutdown = async () => {
  console.log('\nPostgreSQL afsluiten …');
  await pg.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
