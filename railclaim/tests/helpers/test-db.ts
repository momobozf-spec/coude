import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'

/**
 * A real Postgres (PGlite, PG18) with the actual migrations applied, plus a
 * minimal shim for the Supabase-provided pieces our schema depends on:
 * the `auth` schema, `auth.users`, `auth.uid()` and the anon/authenticated/
 * service_role roles.
 *
 * This exists so RLS is genuinely exercised — policies are asserted by trying
 * to read and write as a real, non-superuser role, not by inspecting catalogs.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

/**
 * Supabase sets `request.jwt.claims` per request and `auth.uid()` reads the
 * `sub` claim out of it. Same contract here.
 */
const AUTH_SHIM = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text unique
  );

  -- Note the inner nullif: once a custom GUC has been set and rolled back it
  -- reads as '' rather than NULL, and ''::json raises. Real Supabase has the
  -- same guard.
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $fn$
    select nullif(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
      ''
    )::uuid;
  $fn$;

  do $do$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls;
    end if;
  end
  $do$;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth   to anon, authenticated, service_role;
  grant select on auth.users   to authenticated, service_role;
`

/**
 * Supabase grants table privileges to anon/authenticated automatically as
 * tables are created, and relies on RLS to narrow them. It does this with
 * ALTER DEFAULT PRIVILEGES, so the grant lands at CREATE TABLE time.
 *
 * That ordering matters: our migration REVOKEs those grants again on the
 * internal tables (stripe_events, worker_heartbeats, admin_users). Applying
 * blanket grants *after* migrating would silently undo the revoke and the
 * tests would pass for the wrong reason.
 */
const DEFAULT_PRIVILEGES = `
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
`

export interface TestDb {
  /** Run SQL as the owner (superuser) — setup and teardown only. */
  sql(query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  /** Run SQL as `authenticated` with auth.uid() bound to userId. */
  asUser(
    userId: string,
    query: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>
  /** Run SQL as `anon` (signed out). */
  asAnon(query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  /** Run SQL as `service_role` — bypasses RLS, like the worker. */
  asServiceRole(
    query: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>
  createUser(email: string): Promise<string>
  makeAdmin(userId: string): Promise<void>
  close(): Promise<void>
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create()

  await db.exec(AUTH_SHIM)
  await db.exec(DEFAULT_PRIVILEGES)

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }

  async function runAs(
    role: string,
    userId: string | null,
    query: string,
    params: unknown[] = [],
  ) {
    // A transaction keeps the role switch and the claim scoped to this call.
    await db.exec('begin')
    try {
      const claims = userId ? JSON.stringify({ sub: userId, role }) : JSON.stringify({ role })
      await db.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
      await db.exec(`set local role ${role}`)
      const result = await db.query(query, params)
      await db.exec('commit')
      return { rows: result.rows as Record<string, unknown>[] }
    } catch (error) {
      await db.exec('rollback')
      throw error
    }
  }

  return {
    async sql(query, params = []) {
      const result = await db.query(query, params)
      return { rows: result.rows as Record<string, unknown>[] }
    },
    asUser: (userId, query, params) => runAs('authenticated', userId, query, params),
    asAnon: (query, params) => runAs('anon', null, query, params),
    asServiceRole: (query, params) => runAs('service_role', null, query, params),

    async createUser(email) {
      const result = await db.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      )
      return result.rows[0].id
    },

    async makeAdmin(userId) {
      await db.query('insert into public.admin_users (user_id) values ($1)', [userId])
    },

    async close() {
      await db.close()
    },
  }
}

/** Seed the verified compensation rules, exactly as production does. */
export async function seedCompensationRules(db: TestDb): Promise<void> {
  const { VERIFIED_COMPENSATION_RULES } = await import(
    '../../src/lib/compensation/verified-rules'
  )
  for (const rule of VERIFIED_COMPENSATION_RULES) {
    await db.sql(
      `insert into public.compensation_rules (rule_key, parameters, source_url, verified_at)
       values ($1, $2, $3, $4)
       on conflict (rule_key) do update
         set parameters = excluded.parameters,
             source_url = excluded.source_url,
             verified_at = excluded.verified_at`,
      [rule.rule_key, JSON.stringify(rule.parameters), rule.source_url, rule.verified_at],
    )
  }
}
