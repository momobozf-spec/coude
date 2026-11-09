import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 haalt de connectie-URL hier vandaan in plaats van uit schema.prisma.
 * Dit bestand wordt alleen door de Prisma CLI gelezen (migrate, studio, db push);
 * de runtime-client bouwt zijn eigen adapter in src/db/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
