import 'server-only'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma singleton (Prisma 7, `pg` driver adapter — no query-engine binary).
 *
 * Created lazily: `next build` imports this module without a database, and the
 * first real query is what opens the pool. Kept on `globalThis` so development
 * hot-reloads do not open a new pool on every edit.
 */

function poolMax(): number {
  const n = Number(process.env.DATABASE_POOL_MAX ?? 5)
  return Number.isInteger(n) && n > 0 ? n : 5
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const adapter = new PrismaPg({ connectionString, max: poolMax() })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient()
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
