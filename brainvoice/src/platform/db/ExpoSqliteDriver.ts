import * as SQLite from 'expo-sqlite';

import type { SqlDriver, SqlExecutor, SqlRunResult, SqlValue } from '@core/db/SqlDriver';

type TransactionHandle = Parameters<Parameters<SQLite.SQLiteDatabase['withExclusiveTransactionAsync']>[0]>[0];

class TransactionExecutor implements SqlExecutor {
  readonly dialect = 'sqlite' as const;
  constructor(private readonly txn: TransactionHandle) {}

  async run(sql: string, params: SqlValue[] = []): Promise<SqlRunResult> {
    const result = await this.txn.runAsync(sql, params as SQLite.SQLiteBindParams);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  all<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.txn.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  get<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return this.txn.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  exec(sql: string): Promise<void> {
    return this.txn.execAsync(sql);
  }
}

/** SqlDriver on top of expo-sqlite (the on-device database). */
export class ExpoSqliteDriver implements SqlDriver {
  readonly dialect = 'sqlite' as const;
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(databaseName = 'brainvoice.db'): Promise<ExpoSqliteDriver> {
    const db = await SQLite.openDatabaseAsync(databaseName);
    return new ExpoSqliteDriver(db);
  }

  async run(sql: string, params: SqlValue[] = []): Promise<SqlRunResult> {
    const result = await this.db.runAsync(sql, params as SQLite.SQLiteBindParams);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  all<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  get<T extends object = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  exec(sql: string): Promise<void> {
    return this.db.execAsync(sql);
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    let result: T | undefined;
    let failure: unknown = null;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      try {
        result = await fn(new TransactionExecutor(txn));
      } catch (e) {
        failure = e;
        throw e;
      }
    });
    if (failure) throw failure;
    return result as T;
  }

  close(): Promise<void> {
    return this.db.closeAsync();
  }
}
