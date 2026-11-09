/**
 * Dataminimalisatie: opruimen en verwijderen.
 *
 * ─── WAAROM DIT GEEN CRON-SCRIPTJE IS MAAR EEN SERVICE ───────────────────────
 *
 * Deze dienst verzamelt contactgegevens van particulieren die er niet om
 * gevraagd hebben. Dat brengt twee harde verplichtingen mee: alleen bewaren wat
 * nodig is, en op verzoek kunnen wissen. Allebei moeten ze *uitvoerbaar* zijn —
 * een privacybelofte die alleen in een README staat is geen maatregel.
 *
 * Vandaar drie functies die elk een echte vraag beantwoorden:
 *
 *   purgeExpiredData()   automatisch: wat te oud is, gaat weg
 *   redactSeller()       "verwijder mijn gegevens" van één persoon
 *   deleteListing()      "haal deze advertentie weg" van één woning
 *
 * ─── REDACTEREN OF VERWIJDEREN ───────────────────────────────────────────────
 *
 * Bij een verzoek van een persoon wissen we de persoonsgegevens maar houden we
 * de rij, met `redactedAt` gezet. Dat lijkt tegenstrijdig maar is het niet: de
 * lege rij is precies het bewijs dát er gewist is, en hij voorkomt dat dezelfde
 * gegevens bij de volgende collector-run gewoon opnieuw binnenkomen zonder dat
 * iemand het merkt. Wat weg moet — naam, telefoon — is echt weg.
 */
import { Prisma } from '@prisma/client'

import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/repositories/prisma'

import { writeAudit } from './auditService'

const logger = createLogger({ component: 'retention' })

export interface PurgeResult {
  listingsArchived: number
  listingsDeleted: number
  rawPayloadsCleared: number
  sellersRedacted: number
}

/**
 * De automatische opruiming. Idempotent, dus veilig om vaak te draaien.
 *
 * Twee termijnen, met opzet verschillend:
 *
 *   RETENTION_RAW_PAYLOAD_DAYS (kort)  De ruwe bronpayload dient alleen om een
 *                                      parsingfout na te kijken. Na twee weken
 *                                      is dat voorbij en is het alleen nog een
 *                                      tweede kopie van persoonsgegevens.
 *   RETENTION_LISTING_DAYS (lang)      De advertentie zelf, inclusief de
 *                                      verkoper, wanneer we hem al maanden niet
 *                                      meer zien.
 */
export async function purgeExpiredData(now: Date = new Date()): Promise<PurgeResult> {
  const env = getEnv()
  const result: PurgeResult = {
    listingsArchived: 0,
    listingsDeleted: 0,
    rawPayloadsCleared: 0,
    sellersRedacted: 0,
  }

  // ── 1. Ruwe payloads wissen ───────────────────────────────────────────────
  if (env.RETENTION_RAW_PAYLOAD_DAYS > 0) {
    const cutoff = daysAgo(now, env.RETENTION_RAW_PAYLOAD_DAYS)
    const cleared = await prisma.listing.updateMany({
      // `Prisma.DbNull` is de SQL-NULL; `Prisma.JsonNull` zou het JSON-token
      // `null` zijn. Het verschil telt hier: we zoeken rijen waar wérkelijk
      // iets staat, en willen ze op SQL-NULL zetten in plaats van op de
      // JSON-waarde null, die evenveel ruimte inneemt als de payload zelf.
      where: { firstSeenAt: { lt: cutoff }, NOT: { rawPayload: { equals: Prisma.DbNull } } },
      data: { rawPayload: Prisma.DbNull },
    })
    result.rawPayloadsCleared = cleared.count
  }

  if (env.RETENTION_LISTING_DAYS <= 0) return result

  const cutoff = daysAgo(now, env.RETENTION_LISTING_DAYS)

  // ── 2. Advertenties die we al lang niet meer zien ─────────────────────────
  // Eerst archiveren (persoonsgegevens los, herkomst blijft), dan pas de
  // Seller-rijen die daardoor nergens meer aan hangen.
  const expired = await prisma.listing.findMany({
    where: { lastSeenAt: { lt: cutoff }, status: { not: 'REDACTED' } },
    select: { id: true, sellerId: true },
    take: 1000,
  })

  if (expired.length === 0) return result

  const listingIds = expired.map((listing) => listing.id)

  await prisma.listing.updateMany({
    where: { id: { in: listingIds } },
    data: {
      status: 'ARCHIVED',
      // Contactgegevens gaan weg; herkomst (bron, url, wanneer gezien) blijft,
      // want dat is wat een klacht controleerbaar maakt.
      description: null,
      address: null,
      rawPayload: Prisma.DbNull,
      redactedAt: now,
    },
  })
  result.listingsArchived = listingIds.length

  await prisma.listingHistory.createMany({
    data: listingIds.map((listingId) => ({
      listingId,
      changeType: 'ARCHIVED' as const,
      note: `Automatisch opgeruimd na ${env.RETENTION_LISTING_DAYS} dagen zonder waarneming`,
    })),
  })

  // ── 3. Verkopers zonder actieve advertentie ───────────────────────────────
  const sellerIds = [...new Set(expired.map((listing) => listing.sellerId).filter(isString))]

  for (const sellerId of sellerIds) {
    const stillActive = await prisma.listing.count({
      where: { sellerId, status: 'ACTIVE' },
    })
    if (stillActive > 0) continue

    await prisma.seller.update({
      where: { id: sellerId },
      data: { displayName: null, phoneE164: null, reasons: [], redactedAt: now },
    })
    result.sellersRedacted += 1
  }

  logger.info('Bewaartermijnen toegepast', { ...result })
  await writeAudit({
    actor: 'system:retention',
    action: 'PURGE_EXPIRED_DATA',
    metadata: { ...result },
  })

  return result
}

/**
 * Wist de persoonsgegevens van één verkoper.
 *
 * Dit is de knop achter een verzoek tot verwijdering. Hij raakt ook de
 * advertenties van die verkoper aan: de beschrijving kan het telefoonnummer
 * bevatten waar het uit gehaald is, en de naam staat soms in de titel.
 */
export async function redactSeller(
  sellerId: string,
  actor: string,
): Promise<{ sellerRedacted: boolean; listingsRedacted: number }> {
  const now = new Date()

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, listings: { select: { id: true } } },
  })
  if (!seller) return { sellerRedacted: false, listingsRedacted: 0 }

  const listingIds = seller.listings.map((listing) => listing.id)

  await prisma.$transaction([
    prisma.seller.update({
      where: { id: sellerId },
      data: { displayName: null, phoneE164: null, reasons: [], redactedAt: now },
    }),
    prisma.listing.updateMany({
      where: { id: { in: listingIds } },
      data: {
        status: 'REDACTED',
        title: null,
        description: null,
        address: null,
        rawPayload: Prisma.DbNull,
        redactedAt: now,
      },
    }),
    // Ook de verstuurde berichten: die bevatten het telefoonnummer letterlijk.
    prisma.alert.updateMany({
      where: { listingId: { in: listingIds } },
      data: { messageText: '[verwijderd op verzoek]' },
    }),
    prisma.listingHistory.createMany({
      data: listingIds.map((listingId) => ({
        listingId,
        changeType: 'REDACTED' as const,
        note: 'Persoonsgegevens gewist op verzoek',
      })),
    }),
  ])

  logger.info('Verkoper gewist', { sellerId, listings: listingIds.length })
  await writeAudit({
    actor,
    action: 'REDACT_SELLER',
    entityType: 'Seller',
    entityId: sellerId,
    metadata: { listingsRedacted: listingIds.length },
  })

  return { sellerRedacted: true, listingsRedacted: listingIds.length }
}

/**
 * Verwijdert één advertentie volledig, inclusief historiek en alerts.
 *
 * Anders dan `redactSeller` blijft er hier niets staan. Bedoeld voor het geval
 * dat een bron laat weten dat een advertentie niet verwerkt had mogen worden.
 */
export async function deleteListing(listingId: string, actor: string): Promise<boolean> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, url: true, sourceId: true, sellerId: true },
  })
  if (!listing) return false

  // Cascade ruimt history en alerts op (zie het schema).
  await prisma.listing.delete({ where: { id: listingId } })

  if (listing.sellerId) {
    const remaining = await prisma.listing.count({ where: { sellerId: listing.sellerId } })
    if (remaining === 0) {
      await prisma.seller.delete({ where: { id: listing.sellerId } })
    }
  }

  logger.info('Advertentie verwijderd', { listingId })
  await writeAudit({
    actor,
    action: 'DELETE_LISTING',
    entityType: 'Listing',
    entityId: listingId,
    metadata: { url: listing.url },
  })

  return true
}

function daysAgo(from: Date, days: number): Date {
  return new Date(from.getTime() - days * 24 * 3_600_000)
}

function isString(value: string | null): value is string {
  return value !== null
}
