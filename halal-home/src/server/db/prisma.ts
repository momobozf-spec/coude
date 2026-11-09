/**
 * De enige plek waar een PrismaClient wordt aangemaakt.
 *
 * In development herlaadt Next de servermodules bij elke wijziging. Zonder de
 * global-cache hieronder maakt elke hot reload een nieuwe pool aan en loopt
 * Postgres binnen een paar minuten vol met verbindingen.
 *
 * Regel: React-componenten importeren dit bestand niet. Queries horen in een
 * repository onder `src/modules/<domein>/repository.ts`, zodat user isolation
 * op één plek per domein afdwingbaar is en niet verspreid over de UI.
 */
import 'server-only'
import { PrismaClient } from '@prisma/client'
import { env, isProduction } from '@/config/env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.LOG_LEVEL === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (!isProduction) globalForPrisma.prisma = prisma
