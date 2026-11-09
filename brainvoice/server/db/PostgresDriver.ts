import pg from 'pg';

import type { SqlDriver, SqlExecutor, SqlRunResult, SqlValue } from '../../src/core/db/SqlDriver';

/**
 * SqlDriver on PostgreSQL (production persistence, §Phase 2). The repositories are written
 * in portable SQL with `?` placeholders; this driver converts them to `$n` and translates
 * the four SQLite idioms the schema uses (`INSERT OR IGNORE`, `strftime(...,'now')`,
 * `json_extract(col, '$.key')`, `rowid`). Concurrency-sensitive statements (job claims)
 * branch on `dialect` inside the repositories, so they use real row locks here
 * (`FOR UPDATE SKIP LOCKED`) instead of SQLite's single-writer serialisation.
 */

const STRFTIME_NOW = /strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now'\)/g;
const JSON_EXTRACT = /json_extract\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*,\s*'\$\.([a-zA-Z0-9_]+)'\s*\)/g;

export function rewriteSql(sql: string): string {
  let out = sql.trim();
  if (/^INSERT\s+OR\s+IGNORE\s+INTO/i.test(out)) {
    out = out.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO').replace(/;\s*$/, '');
    out = `${out} ON CONFLICT DO NOTHING`;
  }
  out = out.replace(STRFTIME_NOW, `to_char((now() at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
  out = out.replace(JSON_EXTRACT, (_m, column: string, key: string) => `(${column}::json->>'${key}')`);
  out = out.replace(/\browid\b/g, 'seq');
  out = out.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  // ? → $n outside single-quoted literals
  let index = 0;
  let inQuote = false;
  let result = '';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i]!;
    if (ch === "'") {
      inQuote = !inQuote;
      result += ch;
      continue;
    }
    if (ch === '?' && !inQuote) {
      index++;
      result += `$${index}`;
      continue;
    }
    result += ch;
  }
  return result;
}

function toParams(params: SqlValue[]): unknown[] {
  return params.map((p) => (p instanceof Uint8Array && !Buffer.isBuffer(p) ? Buffer.from(p) : p));
}

type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

class PgExecutor implements SqlExecutor {
  readonly dialect = 'postgres' as const;

  constructor(protected readonly target: Queryable) {}

  async run(sql: string, params: SqlValue[] = []): Promise<SqlRunResult> {
    const result = await this.target.query(rewriteSql(sql), toParams(params));
    return { changes: result.rowCount ?? 0, lastInsertRowId: 0 };
  }

  async all<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const result = await this.target.query(rewriteSql(sql), toParams(params));
    return result.rows as T[];
  }

  async get<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  async exec(sql: string): Promise<void> {
    const trimmed = sql.trim();
    if (!trimmed || /^PRAGMA\b/i.test(trimmed)) return;
    await this.target.query(rewriteSql(trimmed));
  }
}

export interface PostgresDriverOptions {
  connectionString: string;
  /** `true` or an object for TLS; `false` for local development. */
  ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string };
  max?: number;
  /** Optional schema; created when missing and set as search_path for every connection. */
  schema?: string | null;
}

export class PostgresDriver extends PgExecutor implements SqlDriver {
  private readonly pool: pg.Pool;
  private readonly schema: string | null;

  constructor(options: PostgresDriverOptions) {
    const pool = new pg.Pool({ connectionString: options.connectionString, ssl: options.ssl === true ? { rejectUnauthorized: true } : options.ssl === false || options.ssl === undefined ? undefined : options.ssl, max: options.max ?? 10 });
    super(pool);
    this.pool = pool;
    this.schema = options.schema ?? null;
    const schema = this.schema;
    pool.on('connect', (client) => {
      // The schema stores UTF-8 text (names, approval cards with symbols); Windows servers default to WIN1252.
      void client.query(`SET client_encoding TO 'UTF8'${schema ? `; SET search_path TO "${schema.replace(/"/g, '')}"` : ''}`);
    });
  }

  /** Creates the schema when configured; call once before migrations. */
  async prepare(): Promise<void> {
    if (!this.schema) return;
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema.replace(/"/g, '')}"`);
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET client_encoding TO 'UTF8'${this.schema ? `; SET search_path TO "${this.schema.replace(/"/g, '')}"` : ''}`);
      await client.query('BEGIN');
      try {
        const result = await fn(new PgExecutor(client));
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      }
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
