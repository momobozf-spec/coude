/**
 * Minimal SQL driver abstraction so the domain layer can run on
 * expo-sqlite (device) and node:sqlite (tests) with the same code.
 */

export type SqlValue = string | number | null | Uint8Array;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

/** SQL dialect of the engine behind an executor; repositories branch on it only for locking semantics. */
export type SqlDialect = 'sqlite' | 'postgres';

export interface SqlExecutor {
  readonly dialect: SqlDialect;
  run(sql: string, params?: SqlValue[]): Promise<SqlRunResult>;
  all<T extends object = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T extends object = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Executes one or more statements without parameters (DDL, PRAGMA). */
  exec(sql: string): Promise<void>;
}

export interface SqlDriver extends SqlExecutor {
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function toBool(value: SqlValue | undefined): boolean {
  return value === 1 || value === '1';
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

export function parseJson<T>(value: SqlValue | undefined, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function nullable(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : value === null || value === undefined ? null : String(value);
}

export function numberOrNull(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : value === null || value === undefined ? null : Number(value);
}
