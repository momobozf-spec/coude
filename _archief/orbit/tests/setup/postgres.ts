import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Globale opzet voor de integratietests: een eigen PostgreSQL, los van de
 * ontwikkeldatabase.
 *
 * Tegen een echte PostgreSQL testen en niet tegen SQLite of een mock: de helft
 * van wat we willen bewijzen (de server_seq-triggers, partiële indexen,
 * `nulls: last` bij het sorteren, JSONB) bestaat alleen in PostgreSQL.
 */

const DATA_DIR = fileURLToPath(new URL('../../packages/db/.pgdata-test', import.meta.url));
const SCHEMA = fileURLToPath(new URL('../../packages/db/prisma/schema.prisma', import.meta.url));
const SQL_FILE = fileURLToPath(
  new URL('../../packages/db/prisma/sql/001_sync_infrastructure.sql', import.meta.url),
);
const DB_ROOT = fileURLToPath(new URL('../../packages/db', import.meta.url));

const PORT = Number(process.env.ORBIT_TEST_DB_PORT ?? 5443);
const DATABASE_URL = `postgresql://orbit:orbit@localhost:${PORT}/orbit_test?schema=public`;

let postgres: EmbeddedPostgres | null = null;

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: DB_ROOT,
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
    shell: true,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} faalde:\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
}

export async function setup(): Promise<void> {
  // Altijd vanaf nul: een testdatabase met restjes van een vorige run levert
  // tests op die vandaag slagen en morgen niet.
  if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });

  postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'orbit',
    password: 'orbit',
    port: PORT,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('orbit_test');

  process.env.DATABASE_URL = DATABASE_URL;

  run('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA]);
  run('npx', ['prisma', 'db', 'execute', '--file', SQL_FILE, '--schema', SCHEMA]);
}

export async function teardown(): Promise<void> {
  await postgres?.stop();
  postgres = null;
  if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
}

export { DATABASE_URL };
