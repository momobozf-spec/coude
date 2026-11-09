import { PrismaClient } from '@prisma/client'

/**
 * Eén PrismaClient per proces.
 *
 * In development herlaadt Next bij elke wijziging de servermodules. Zonder deze
 * globale cache maakt elke herlaadbeurt een nieuwe client met een nieuwe pool,
 * en loopt PostgreSQL na twintig bewerkingen vol met "too many clients".
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * ─── WAAROM `error` NIET IN DE LOGCONFIGURATIE STAAT ─────────────────────────
 *
 * Dit systeem gebruikt unique-constraints als werkend mechanisme, niet als
 * vangnet: `ListingEvent.dedupeKey`, `Opportunity.dedupeKey` en `Alert.dedupeKey`
 * maken dubbel werk fysiek onmogelijk, en een botsing (P2002) betekent gewoon
 * "iemand anders was eerder". De repositories vangen die af en geven `null`.
 *
 * Met `error` in de logconfiguratie drukt Prisma zo'n afgevangen botsing tóch af
 * op stderr, compleet met codeframe. Een tweede seed-run of een herhaalde
 * collectorrun ziet er dan uit alsof er iets stuk is, terwijl het systeem
 * precies doet wat het hoort te doen — en dat leert mensen logregels negeren.
 *
 * Dit onderdrukt geen echte fouten: Prisma gooit ze hoe dan ook als exception,
 * met stack trace. Wat hier wegvalt is uitsluitend de dubbele afdruk.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn'] : [],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
