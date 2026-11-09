/**
 * Start de lokale PostgreSQL en de gebouwde Next-server, en blijft draaien.
 *
 * Bewust gescheiden van de rooktest: procesbeheer en HTTP-assertions in één
 * script maken een vastloper onmogelijk te diagnosticeren, omdat je dan niet
 * ziet welke van de twee hangt.
 *
 * Gebruik:  node apps/web/scripts/serve-local.mjs [poort]
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startLocalPostgres, LOCAL_DATABASE_URL } from '../../../packages/db/scripts/local-db.mjs';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3100);
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));

const postgres = await startLocalPostgres();
console.log(`postgres: ${LOCAL_DATABASE_URL}`);

// `shell: true` is op Windows nodig: Node 24 weigert een .cmd rechtstreeks te
// spawnen (EINVAL). Het gevolg is dat kill() de shell raakt en niet het
// kindproces; het afsluiten hieronder ruimt daarom op poortnummer op.
const server = spawn(
  'npx',
  ['next', 'start', '--port', String(PORT)],
  {
    cwd: WEB_ROOT,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'lokaal-ontwikkelgeheim-van-ruim-32-tekens',
      APP_URL: `http://localhost:${PORT}`,
    },
  },
);

async function shutdown() {
  server.kill();
  await postgres.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', shutdown);
