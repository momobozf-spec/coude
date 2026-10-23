import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __tkPool?: Pool; __tkDb?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const pool = globalForDb.__tkPool ?? new Pool({ connectionString: url, max: 10 });
  globalForDb.__tkPool = pool;
  return drizzle(pool, { schema });
}

export const db: DB = globalForDb.__tkDb ?? (globalForDb.__tkDb = createDb());
export { schema };

export async function closeDb() {
  await globalForDb.__tkPool?.end();
  globalForDb.__tkPool = undefined;
  globalForDb.__tkDb = undefined;
}
