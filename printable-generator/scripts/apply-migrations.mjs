// Applies prisma/migrations/*/migration.sql in order to DATABASE_URL (local file or Turso).
// Prisma Migrate cannot talk to a remote libsql/Turso database directly, so this small
// runner keeps track of applied migrations in the table "_app_migrations".
// Usage: node scripts/apply-migrations.mjs
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "prisma", "migrations");
const client = createClient({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

await client.execute(
  'CREATE TABLE IF NOT EXISTS "_app_migrations" ("name" TEXT PRIMARY KEY, "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
);
// A database created earlier with `prisma migrate` already has its own history table.
let prismaApplied = new Set();
try {
  const r = await client.execute('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
  prismaApplied = new Set(r.rows.map((row) => String(row.migration_name)));
} catch {
  /* no prisma history table */
}
const done = new Set((await client.execute('SELECT name FROM "_app_migrations"')).rows.map((r) => String(r.name)));

const names = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "migration.sql")))
  .map((d) => d.name)
  .sort();

let applied = 0;
for (const name of names) {
  if (done.has(name)) continue;
  if (prismaApplied.has(name)) {
    await client.execute({ sql: 'INSERT INTO "_app_migrations" (name) VALUES (?)', args: [name] });
    continue;
  }
  const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
  await client.executeMultiple(sql);
  await client.execute({ sql: 'INSERT INTO "_app_migrations" (name) VALUES (?)', args: [name] });
  console.log(`applied ${name}`);
  applied++;
}
console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");
