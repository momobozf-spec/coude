import 'server-only'

import { PrismaClient } from '@prisma/client'
import { isProduction } from '@/config/env'

/**
 * Prisma singleton.
 *
 * In development Next.js hot-reloads modules, which would otherwise open a new
 * connection pool on every edit until Postgres refuses connections.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  })

if (!isProduction) globalForPrisma.prisma = prisma
