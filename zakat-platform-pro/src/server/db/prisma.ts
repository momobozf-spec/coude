import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { isProduction } from '@/config/env'
import { createPrismaClient } from '@/server/db/create-client'

/**
 * Prisma singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until Postgres refuses connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  createPrismaClient(process.env.DATABASE_URL, isProduction ? ['error'] : ['warn', 'error'])

if (!isProduction) globalForPrisma.prisma = prisma
