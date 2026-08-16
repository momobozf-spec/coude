/**
 * DB-backed test helper. Suites using this are skipped automatically when
 * TEST_DATABASE_URL is not set. The schema is pushed once per test run.
 */

import { execSync } from "node:child_process";
import { PrismaClient } from "@/generated/prisma";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? null;

let client: PrismaClient | null = null;
let pushed = false;

export function testDb(): PrismaClient {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL not set");
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  }
  return client;
}

export function ensureSchema(): void {
  if (pushed || !TEST_DATABASE_URL) return;
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
  pushed = true;
}

export async function truncateAll(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations')
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
