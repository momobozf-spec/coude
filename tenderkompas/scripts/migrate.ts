/**
 * Productiemigratie zonder drizzle-kit (dat is een devDependency): past ./drizzle toe met de runtime-migrator.
 * Dezelfde migraties als `npm run db:migrate` en als de testopzet. Gebruik: npm run db:migrate:prod
 *
 * Met DATABASE_SCHEMA=<naam> (gedeeld Supabase-project, één schema per app):
 * - het schema wordt aangemaakt als het nog niet bestaat;
 * - de migraties worden naar een tijdelijke map gekopieerd met `"public".` herschreven naar het
 *   app-schema (drizzle-kit zet die kwalificatie hard in enum-types en FK-verwijzingen), en daarna
 *   met de gewone drizzle-migrator toegepast, met search_path op het app-schema;
 * - de boekhoudtabel `__drizzle_migrations` staat in het app-schema zelf (migrationsSchema).
 * Bewust een kopie + de publieke migrator in plaats van eigen SQL-uitvoering: volgorde, transactie
 * en boekhouding blijven die van drizzle. Zonder DATABASE_SCHEMA: exact het oude gedrag.
 */
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { poolConfig, resolveDbSchema } from "../src/db/db-schema";
import { prepareMigrationsFolder } from "../src/db/migrations-folder";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const schema = resolveDbSchema();

  if (!schema) {
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      await migrate(drizzle(pool), { migrationsFolder });
      console.log("Migraties toegepast.");
    } finally {
      await pool.end();
    }
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tk-migrations-"));
  const pool = new Pool(poolConfig(url, 1, schema));
  try {
    prepareMigrationsFolder(migrationsFolder, schema, tmp);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await migrate(drizzle(pool), { migrationsFolder: tmp, migrationsSchema: schema });
    console.log(`Migraties toegepast in schema ${schema}.`);
  } finally {
    await pool.end();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
