import 'server-only'

import { PrismaClient } from '@prisma/client'

/**
 * Eén PrismaClient per proces.
 *
 * In development herlaadt Next de servermodules bij elke wijziging. Zonder deze
 * globale cache levert dat een nieuwe connectiepool per herlading op, en na een
 * halve werkdag een database die geen verbindingen meer accepteert.
 *
 * Bewust `process.env.NODE_ENV` en niet `getEnv()`: deze module wordt door Next
 * geïmporteerd tijdens het verzamelen van pagina's in de build, en de volledige
 * env-validatie hoort daar niet te draaien. Alleen het logniveau hangt hiervan
 * af; de connectiestring leest Prisma zelf.
 */
const isDevelopment = process.env.NODE_ENV === 'development'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
