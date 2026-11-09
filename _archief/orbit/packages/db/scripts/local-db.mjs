/**
 * Lokale PostgreSQL zonder Docker.
 *
 * `embedded-postgres` pakt een echte PostgreSQL-binary uit in node_modules en
 * start die op een eigen poort met een datadirectory in het project. Dat maakt
 * migraties, seeds en integratietests draaibaar op een machine waar geen Docker
 * of systeem-PostgreSQL staat, zonder dat we het schema hoeven te versimpelen.
 *
 * Gebruik:
 *   node scripts/local-db.mjs start          blijft draaien (voor npm run dev)
 *   node scripts/local-db.mjs run "<cmd>"    start, voert cmd uit, stopt weer
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(packageRoot, '.pgdata');

// Bewust niet 5432 of 5433: op deze machine draaien andere projecten daar al
// een eigen PostgreSQL. Overschrijfbaar via ORBIT_DB_PORT.
export const LOCAL_DB_PORT = Number(process.env.ORBIT_DB_PORT ?? 5442);
export const LOCAL_DATABASE_URL = `postgresql://orbit:orbit@localhost:${LOCAL_DB_PORT}/orbit?schema=public`;

export function createLocalPostgres() {
  return new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'orbit',
    password: 'orbit',
    port: LOCAL_DB_PORT,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
}

export async function startLocalPostgres() {
  const postgres = createLocalPostgres();
  const firstRun = !existsSync(dataDir);

  if (firstRun) {
    console.log('PostgreSQL initialiseren in packages/db/.pgdata ...');
    await postgres.initialise();
  }

  await postgres.start();

  if (firstRun) {
    await postgres.createDatabase('orbit');
    console.log('Database "orbit" aangemaakt.');
  }

  return postgres;
}

function runCommand(command) {
  return new Promise((resolveCommand) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
    });
    child.on('exit', (code) => resolveCommand(code ?? 1));
  });
}

async function main() {
  const [mode, command] = process.argv.slice(2);

  if (mode === 'start') {
    const postgres = await startLocalPostgres();
    console.log(`PostgreSQL draait op poort ${LOCAL_DB_PORT}.`);
    console.log(`DATABASE_URL="${LOCAL_DATABASE_URL}"`);
    const stop = async () => {
      await postgres.stop();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    return;
  }

  if (mode === 'run' && command) {
    const postgres = await startLocalPostgres();
    try {
      const code = await runCommand(command);
      process.exitCode = code;
    } finally {
      await postgres.stop();
    }
    return;
  }

  console.error('Gebruik: node scripts/local-db.mjs start | run "<commando>"');
  process.exitCode = 1;
}

// Alleen uitvoeren als dit bestand het startpunt is; tests importeren het ook.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
