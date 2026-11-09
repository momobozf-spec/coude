import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

// Postgres bigint (bv. count) als number teruggeven.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function one<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const r = await q.query(sql, params);
  if (r.rowCount !== 1) throw new Error(`verwachtte 1 rij, kreeg ${r.rowCount}`);
  return r.rows[0] as T;
}

export async function maybeOne<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await q.query(sql, params);
  return (r.rows[0] as T | undefined) ?? null;
}

export async function many<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await q.query(sql, params);
  return r.rows as T[];
}
