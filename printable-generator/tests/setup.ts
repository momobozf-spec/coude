// Per-test-file setup: a fresh SQLite database with all Prisma migrations applied,
// a mocked Auth.js session and safe test env vars. No network, no real keys.
import { vi, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "noor-test-"));
const dbFile = join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET = "test-auth-secret-0123456789abcdef0123456789";
process.env.STRIPE_SECRET_KEY = "sk_test_unit_tests_only";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_pro_y";
process.env.STRIPE_SCHOOL_MONTHLY_PRICE_ID = "price_school_m";
process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID = "price_school_y";
delete process.env.RESEND_API_KEY;

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const client = createClient({ url: process.env.DATABASE_URL });
for (const name of readdirSync(migrationsDir).sort()) {
  const file = join(migrationsDir, name, "migration.sql");
  if (existsSync(file)) await client.executeMultiple(readFileSync(file, "utf8"));
}
client.close();

// Session mock: tests set `testSession.userId` (null = logged out).
export const testSession: { userId: string | null } = { userId: null };
vi.mock("@/lib/auth", () => ({
  auth: async () => (testSession.userId ? { user: { id: testSession.userId } } : null),
  handlers: {},
  signIn: async () => {},
  signOut: async () => {},
}));

beforeEach(() => {
  testSession.userId = null;
});
