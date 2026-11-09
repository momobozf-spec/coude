/**
 * Local development database — no install, no Docker, no account.
 *
 * PGlite is real PostgreSQL compiled to WebAssembly; pglite-socket puts it
 * behind a TCP port speaking the Postgres wire protocol, so Prisma connects to
 * it exactly as it would to a normal server. Data lives in ./.pgdata.
 *
 *   npm run db:dev
 *
 * This is a convenience for development only. Production points DATABASE_URL at
 * Supabase (or any Postgres) and never loads this file.
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const dataDir = process.env.PGLITE_DIR ?? "./.pgdata";
const port = Number(process.env.PGLITE_PORT ?? 5432);

const db = await PGlite.create({ dataDir });

const server = new PGLiteSocketServer({
  db,
  port,
  host: "127.0.0.1",
  // The default is 1, which refuses Prisma's second pool connection with
  // "Too many connections" — surfaced confusingly as "Can't reach database".
  maxConnections: 30,
});

await server.start();

console.log(`PostgreSQL (PGlite) luistert op 127.0.0.1:${port}`);
console.log(`Data: ${dataDir}`);
console.log("Laat dit venster open staan. Stoppen met Ctrl+C.");

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
