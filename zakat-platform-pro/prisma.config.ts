import path from 'node:path'

import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 leest de database-URL voor de CLI (migrate, studio) hier en niet meer
 * uit schema.prisma. Geen `env('DATABASE_URL')`: die gooit als de variabele
 * ontbreekt, en `prisma generate` (bij npm install en in de Docker-build) heeft
 * geen database nodig.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
