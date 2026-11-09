import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { config as loadEnv } from "dotenv";

/** Lege testdatabase + dezelfde migraties als productie. */
export default async function setup() {
  loadEnv();
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:lokaal@localhost:54329/klushulp_test";
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
