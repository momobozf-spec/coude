import { Prisma } from '@prisma/client'

import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { expireStaleOpportunities } from '@/repositories/opportunityRepository'
import { prisma } from '@/repositories/prisma'

/**
 * Onderhoud: bewaartermijnen en verlopen kansen.
 *
 * ─── DATAMINIMALISATIE IS EEN ROUTINE, GEEN BELOFTE ──────────────────────────
 *
 * "We bewaren niet meer dan nodig" betekent niets zonder een taak die het
 * daadwerkelijk opruimt. Deze module is die taak. Ze doet drie dingen, in
 * volgorde van hoe gevoelig de data is:
 *
 *   1. Verkoperscontactgegevens uit oude snapshots en van stille verkopers.
 *      Een telefoonnummer van een advertentie van twee jaar geleden heeft geen
 *      enkele functie meer.
 *   2. Ruwe bronpayloads. Die dienen alleen om parsingfouten na te kijken; na
 *      twee weken kijkt niemand ze meer na.
 *   3. Advertenties die lang geleden verdwenen zijn.
 *
 * Panden en events blijven — dat is de historische levensloop waar dit product
 * op draait, en er staan geen persoonsgegevens in.
 *
 * Elke termijn is instelbaar en `0` zet de betreffende opruiming uit.
 */

const logger = createLogger({ component: 'maintenance' })

export interface RetentionResult {
  snapshotsRedacted: number
  payloadsCleared: number
  sellersRedacted: number
  listingsDeleted: number
}

export async function runRetention(now: Date = new Date()): Promise<RetentionResult> {
  const env = getEnv()
  const result: RetentionResult = {
    snapshotsRedacted: 0,
    payloadsCleared: 0,
    sellersRedacted: 0,
    listingsDeleted: 0,
  }

  // 1. Contactgegevens in oude snapshots.
  if (env.RETENTION_SELLER_CONTACT_DAYS > 0) {
    const cutoff = daysAgo(now, env.RETENTION_SELLER_CONTACT_DAYS)

    const snapshots = await prisma.listingSnapshot.updateMany({
      where: { capturedAt: { lt: cutoff }, sellerPhone: { not: null } },
      data: { sellerPhone: null },
    })
    result.snapshotsRedacted = snapshots.count

    // Verkopers die we al die tijd niet meer gezien hebben: naam en nummer weg,
    // rij bewaard zodat listings hun relatie — en dus de geschiedenis van het
    // pand — niet verliezen.
    const sellers = await prisma.sellerIdentity.updateMany({
      where: { lastSeenAt: { lt: cutoff }, redactedAt: null },
      data: { phoneE164: null, displayName: null, normalizedName: null, redactedAt: now },
    })
    result.sellersRedacted = sellers.count
  }

  // 2. Ruwe payloads.
  if (env.RETENTION_RAW_PAYLOAD_DAYS > 0) {
    const cutoff = daysAgo(now, env.RETENTION_RAW_PAYLOAD_DAYS)
    // `Prisma.JsonNull` is de sentinel voor een echte SQL NULL in een
    // Json-kolom; een gewone `null` zou Prisma als "geen wijziging" lezen.
    const payloads = await prisma.listingSnapshot.updateMany({
      where: { capturedAt: { lt: cutoff }, rawData: { not: Prisma.JsonNull } },
      data: { rawData: Prisma.JsonNull },
    })
    result.payloadsCleared = payloads.count
  }

  // 3. Advertenties die lang geleden van de markt gingen.
  if (env.RETENTION_REMOVED_LISTING_DAYS > 0) {
    const cutoff = daysAgo(now, env.RETENTION_REMOVED_LISTING_DAYS)
    const listings = await prisma.listing.deleteMany({
      where: { status: 'REMOVED', removedAt: { lt: cutoff } },
    })
    result.listingsDeleted = listings.count
  }

  logger.info('Bewaartermijnen toegepast', { ...result })
  return result
}

/**
 * Verwijdert alle persoonsgegevens rond één verkoper.
 *
 * Dit is de knop achter een verwijderverzoek. De verkoper blijft als rij bestaan
 * — anders vallen de advertenties en daarmee de pandgeschiedenis om — maar alles
 * wat naar een persoon herleidt is weg, ook uit de snapshots.
 */
export async function redactSeller(sellerId: string, now: Date = new Date()): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: { sellerId },
    select: { id: true },
  })

  await prisma.listingSnapshot.updateMany({
    where: { listingId: { in: listings.map((listing) => listing.id) } },
    data: { sellerPhone: null, sellerName: null },
  })

  await prisma.listing.updateMany({
    where: { sellerId },
    data: { redactedAt: now },
  })

  await prisma.sellerIdentity.update({
    where: { id: sellerId },
    data: {
      displayName: null,
      normalizedName: null,
      phoneE164: null,
      reasons: [],
      redactedAt: now,
    },
  })

  logger.info('Verkoper geanonimiseerd', { sellerId, listings: listings.length })
}

/** Hetzelfde voor een CRM-contact, binnen één kantoor. */
export async function redactCrmContact(
  agencyId: string,
  contactId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await prisma.crmContact.updateMany({
    where: { id: contactId, agencyId },
    data: {
      firstName: null,
      lastName: null,
      displayName: null,
      email: null,
      phone: null,
      emailNormalized: null,
      phoneE164: null,
      nameNormalized: null,
      address: null,
      notes: null,
      redactedAt: now,
    },
  })

  if (result.count === 0) return false

  await prisma.crmInteraction.updateMany({
    where: { contactId, agencyId },
    data: { summary: null, agentName: null },
  })

  logger.info('CRM-contact geanonimiseerd', { agencyId, contactId })
  return true
}

export async function expireOpportunities(now: Date = new Date()): Promise<number> {
  return expireStaleOpportunities(now)
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000)
}
