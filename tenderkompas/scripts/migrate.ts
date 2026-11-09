/**
 * Productiemigratie zonder drizzle-kit (dat is een devDependency): past ./drizzle toe met de runtime-migrator.
 * Dezelfde migraties als `npm run db:migrate` en als de testopzet. Gebruik: npm run db:migrate:prod
 */
import "dotenv/config";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("Migraties toegepast.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
