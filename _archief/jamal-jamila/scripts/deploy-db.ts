/**
 * Apply the Prisma schema to a remote libsql/Turso database, then it can be
 * seeded with `npm run db:seed`.
 *
 * Why this exists: the app uses the SQLite provider with the libsql driver
 * adapter. The Prisma CLI's `db push`/`migrate` only talks to local `file:`
 * SQLite, not a remote `libsql://` URL. So here we:
 *   1. generate the full CREATE SQL from the schema (offline, no DB needed), and
 *   2. execute it against DATABASE_URL via the libsql client.
 *
 * Re-running is safe: "already exists" errors are ignored, so this works for
 * both the first deploy and subsequent ones (new tables/indexes get created).
 *
 * Usage (with prod env loaded):
 *   DATABASE_URL=libsql://...  DATABASE_AUTH_TOKEN=...  npx tsx scripts/deploy-db.ts
 */
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  console.log(`Generating schema SQL from prisma/schema.prisma...`);
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
    { encoding: "utf8" },
  );

  // Strip comment lines (`-- CreateTable` etc.), then split into individual
  // statements (Prisma's SQLite output has no inline ';').
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} statements to ${url.replace(/authToken=[^&]+/, "authToken=***")}...`);
  const client = createClient({
    url,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
  });

  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      applied++;
    } catch (err) {
      const msg = String(err);
      if (/already exists|duplicate column/i.test(msg)) {
        skipped++;
      } else {
        console.error(`Failed statement:\n${stmt}\n`, msg);
        throw err;
      }
    }
  }

  console.log(`Done. Applied ${applied}, skipped ${skipped} (already existed).`);
  console.log(`Next: run \`npm run db:seed\` with the same DATABASE_URL to load data.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
