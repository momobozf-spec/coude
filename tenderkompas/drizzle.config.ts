import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Alleen voor lokaal/public. Met DATABASE_SCHEMA (eigen schema, bv. Supabase) migreren via
// `npm run db:migrate:prod`: drizzle-kit migrate past de SQL toe zoals gegenereerd, met hard "public".
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
