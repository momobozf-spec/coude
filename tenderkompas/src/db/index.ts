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

function getDb(): DB {
  return globalForDb.__tkDb ?? (globalForDb.__tkDb = createDb());
}

/**
 * Lui aangemaakt bij het eerste gebruik: `next build` (en een Docker-build) heeft zo geen DATABASE_URL nodig.
 * Zonder DATABASE_URL faalt pas het eerste databaseverzoek, met dezelfde duidelijke foutmelding.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getDb());
  },
});
export { schema };

export async function closeDb() {
  await globalForDb.__tkPool?.end();
  globalForDb.__tkPool = undefined;
  globalForDb.__tkDb = undefined;
}
