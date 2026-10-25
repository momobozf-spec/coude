import { PrismaClient } from '@/generated/prisma/client'
import { createPgAdapter } from '@/server/db/database-url'

/**
 * Bouwt een PrismaClient met de pg-driver.
 *
 * Prisma 7 praat via een driver adapter met PostgreSQL in plaats van via een
 * Rust-engine. Staat los van `prisma.ts` (dat `server-only` is) zodat de seed en
 * de scripts dezelfde verbindingsinstellingen gebruiken als de app.
 *
 * `DATABASE_POOL_MAX` begrenst de pool per proces: web en worker hebben elk hun
 * eigen pool, en een managed database met weinig verbindingen loopt anders vol
 * zodra een deploy overlapt.
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
  log: ('warn' | 'error')[] = ['warn', 'error'],
): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL ontbreekt. Zet hem in .env (zie .env.example).')
  }

  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10)
  // `?schema=<naam>` in de URL kiest het Postgres-schema (zie database-url.ts).
  const adapter = createPgAdapter(connectionString, {
    max: Number.isFinite(max) && max > 0 ? max : 10,
  })

  return new PrismaClient({ adapter, log })
}
