import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __klushulpPool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  return new Pool({ connectionString: url, max: 10 });
}

export const pool = globalForDb.__klushulpPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__klushulpPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
