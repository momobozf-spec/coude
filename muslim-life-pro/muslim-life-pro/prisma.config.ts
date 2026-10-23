import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 configuration. The connection string lives here (not in the schema);
 * the application itself connects through the `pg` driver adapter in
 * src/server/db/prisma.ts, so no query-engine binary is needed at runtime.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
})
