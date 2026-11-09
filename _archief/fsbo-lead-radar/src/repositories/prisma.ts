import { PrismaClient } from '@prisma/client'

import { getEnv } from '@/lib/env'

/**
 * Eén PrismaClient per proces.
 *
 * In development herlaadt Next elke module bij een wijziging. Zonder de
 * globale cache hieronder zou dat elke keer een nieuwe pool openen, en na een
 * uur werken staat de database vol met verbindingen van modules die niet meer
 * bestaan.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query's loggen in development is nuttig; in productie zou het een
    // logdrain vullen met SQL waar persoonsgegevens in staan.
    log: getEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (getEnv().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export type { PrismaClient }
