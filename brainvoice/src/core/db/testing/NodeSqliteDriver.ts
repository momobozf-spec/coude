import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlExecutor, SqlRunResult, SqlValue } from '../SqlDriver';

/**
 * SqlDriver backed by Node's built-in SQLite (Node ≥ 22.13). Used by the unit
 * tests so that migrations and repositories run against a real SQLite engine.
 * Used by the unit tests and by the Alfred server (server/runtime.ts); never by the app.
 */
export class NodeSqliteDriver implements SqlDriver {
  readonly dialect = 'sqlite' as const;
  private readonly db: DatabaseSync;
  private depth = 0;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  async run(sql: string, params: SqlValue[] = []): Promise<SqlRunResult> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...(params as never[]));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async all<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as never[])) as unknown as T[];
  }

  async get<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...(params as never[]));
    return (row as unknown as T | undefined) ?? null;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (this.depth > 0) return fn(this);
    this.depth++;
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
