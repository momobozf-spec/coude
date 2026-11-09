/**
 * De pijplijn. Van één `RawListing` naar (mogelijk) een verstuurde lead.
 *
 *   normaliseren → verkoper opzoeken → classificeren → dedupliceren
 *   → gebieden matchen → scoren → opslaan → alerteren
 *
 * ─── WAAROM ÉÉN ADVERTENTIE TEGELIJK ─────────────────────────────────────────
 *
 * Batchverwerking zou sneller zijn, maar dit systeem verkoopt snelheid *per
 * lead*, niet doorvoer. Een advertentie die als eerste binnenkomt hoort direct
 * de deur uit te gaan, niet te wachten tot de andere 49 uit dezelfde run
 * verwerkt zijn. En één onparseerbare advertentie mag de andere 49 niet
 * meenemen — vandaar dat elke advertentie zijn eigen try/catch krijgt.
 *
 * ─── WAAROM DE CLASSIFICATIE TWEE KEER KIJKT ─────────────────────────────────
 *
 * De regelmotor draait op de advertentie *plus* wat de database over deze
 * verkoper weet. Die tweede helft is het sterkste signaal dat we hebben: een
 * naam die bij de eerste advertentie particulier leek, is bij de vijfde een
 * kantoor. Daarom wordt de verkoper eerst opgezocht, dán geclassificeerd.
 */
import { classifySeller, subjectFromListing } from '@/domain/classification/classifier'
import { findBestDuplicate, isLikelyRelist } from '@/domain/dedupe/matcher'
import { NormalizationError, normalizeListing } from '@/domain/normalization'
import { ageInMinutes, calculateLeadScore } from '@/domain/scoring/leadScore'
import { bestTerritoryMatch } from '@/domain/territory/match'
import type {
  NormalizedListing,
  RawListing,
  SellerClassification,
  TerritoryDefinition,
} from '@/domain/types'
import { getEnv } from '@/lib/env'
import { toJsonInput } from '@/lib/json'
import { createLogger, type Logger } from '@/lib/logger'
import {
  findBySourceListingId,
  findDuplicateCandidates,
  fromPrismaSellerType,
  recordHistory,
  type HistoryEntry,
  refreshSellerListingCount,
  toPrismaListingType,
  toPrismaSellerType,
  upsertSeller,
} from '@/repositories/listingRepository'
import { prisma } from '@/repositories/prisma'

import { dispatchLead, type AlertCandidate } from './alertService'

const defaultLogger = createLogger({ component: 'ingestion' })

export type IngestOutcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'duplicate'
  | 'rejected'

export interface IngestResult {
  outcome: IngestOutcome
  listingId: string | null
  classification: SellerClassification | null
  leadScore: number
  alertsSent: number
  alertsSuppressed: number
  qualified: boolean
  reason?: string
}

export interface IngestOptions {
  sourceId: string
  sourceName: string
  logger?: Logger
  now?: Date
  /** Uit; de scheduler zet hem aan. Zo kan een herverwerking geen alerts
   *  opnieuw versturen. */
  sendAlerts?: boolean
}

export interface BatchResult {
  fetched: number
  created: number
  updated: number
  unchanged: number
  duplicates: number
  rejected: number
  qualified: number
  alertsSent: number
  alertsSuppressed: number
  errors: string[]
}

/** Alle actieve gebieden, voor de scorecomponent "gebiedsmatch". */
async function loadActiveTerritories(): Promise<TerritoryDefinition[]> {
  const rows = await prisma.territory.findMany({
    where: { active: true, agency: { active: true } },
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    postalCodes: row.postalCodes,
    municipalities: row.municipalities,
    provinces: row.provinces,
    centerLat: row.centerLat,
    centerLng: row.centerLng,
    radiusKm: row.radiusKm,
    active: row.active,
  }))
}

/**
 * Verwerkt één advertentie volledig.
 *
 * Exporteerbaar en zonder collector-context, zodat de pijplijn ook vanuit een
 * test of een herverwerking aangeroepen kan worden.
 */
export async function ingestListing(
  raw: RawListing,
  options: IngestOptions,
  territories?: TerritoryDefinition[],
): Promise<IngestResult> {
  const env = getEnv()
  const logger = options.logger ?? defaultLogger
  const now = options.now ?? new Date()

  // ── 1. Normaliseren ───────────────────────────────────────────────────────
  let listing: NormalizedListing
  try {
    listing = normalizeListing(raw)
  } catch (error) {
    if (error instanceof NormalizationError) {
      logger.warn('Advertentie afgekeurd bij normalisatie', {
        sourceListingId: raw.sourceListingId,
        issues: error.issues,
      })
      return {
        outcome: 'rejected',
        listingId: null,
        classification: null,
        leadScore: 0,
        alertsSent: 0,
        alertsSuppressed: 0,
        qualified: false,
        reason: error.issues.join('; '),
      }
    }
    throw error
  }

  const existing = await findBySourceListingId(options.sourceId, listing.sourceListingId)

  // ── 2. Verkoper opzoeken en classificeren ─────────────────────────────────
  // Eerst een voorlopige classificatie zonder verkopershistorie, want we hebben
  // de verkoper nog niet. Die is alleen nodig om de Seller-rij te kunnen
  // aanmaken; het echte oordeel volgt hieronder met de historie erbij.
  const provisional = classifySeller(subjectFromListing(listing), { knownActiveListings: 0 }, {
    professionalListingCountThreshold: env.PROFESSIONAL_LISTING_COUNT_THRESHOLD,
  })

  const hasSellerData = listing.sellerName !== null || listing.sellerPhoneE164 !== null
  const seller = hasSellerData
    ? await upsertSeller(
        {
          displayName: listing.sellerName,
          phoneE164: listing.sellerPhoneE164,
          classification: provisional.type,
          confidence: provisional.confidence,
          reasons: provisional.reasons,
        },
        now,
      )
    : null

  // Nu wél met historie: hoeveel advertenties kennen we van deze verkoper, en
  // wat vonden we de vorige keer?
  const knownActiveListings = seller
    ? Math.max(seller.activeListingCount, existing === null ? 1 : 0)
    : 0

  const classification = classifySeller(
    subjectFromListing(listing),
    {
      knownActiveListings,
      previousClassification: seller?.previousClassification ?? undefined,
    },
    { professionalListingCountThreshold: env.PROFESSIONAL_LISTING_COUNT_THRESHOLD },
  )

  if (seller) {
    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        classification: toPrismaSellerType(classification.type),
        confidence: classification.confidence,
        reasons: classification.reasons,
        lastSeenAt: now,
      },
    })
  }

  // ── 3. Deduplicatie over bronnen ──────────────────────────────────────────
  const candidates = await findDuplicateCandidates(listing, { excludeSourceId: options.sourceId })
  const duplicate = findBestDuplicate(listing, candidates, env.DUPLICATE_CONFIDENCE_THRESHOLD)

  // Een herplaatsing is iets anders dan een duplicaat: zelfde bron, nieuw id.
  // We gooien hem niet weg, maar hij is minder vers dan hij lijkt.
  const relist =
    existing === null &&
    candidates.some((candidate) => isLikelyRelist({ ...listing, source: options.sourceName }, candidate))

  // ── 4. Gebieden en score ──────────────────────────────────────────────────
  const activeTerritories = territories ?? (await loadActiveTerritories())
  const territoryMatch = bestTerritoryMatch(activeTerritories, listing)

  // Leeftijd vanaf de publicatiedatum als de bron die geeft; anders vanaf het
  // moment dat wíj hem voor het eerst zagen. Nooit vanaf `scrapedAt`: dan zou
  // elke advertentie eeuwig nul minuten oud blijven.
  const referenceMoment = listing.publishedAt ?? existing?.firstSeenAt ?? now
  const score = calculateLeadScore({
    classification,
    hasPhone: listing.sellerPhoneE164 !== null,
    ageMinutes: ageInMinutes(now, referenceMoment),
    territoryPrecision: territoryMatch?.precision ?? null,
    price: listing.price,
    listingType: listing.listingType,
    bedrooms: listing.bedrooms,
    surfaceArea: listing.surfaceArea,
    propertyType: listing.propertyType,
    postalCode: listing.postalCode,
    isDuplicate: duplicate !== null,
    isRelist: relist,
  })

  // ── 5. Opslaan ────────────────────────────────────────────────────────────
  const data = {
    url: listing.url,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    currency: listing.currency,
    listingType: toPrismaListingType(listing.listingType),
    propertyType: listing.propertyType,
    postalCode: listing.postalCode,
    city: listing.city,
    address: listing.address,
    province: listing.province,
    latitude: listing.latitude,
    longitude: listing.longitude,
    bedrooms: listing.bedrooms,
    surfaceArea: listing.surfaceArea,
    sellerId: seller?.id ?? null,
    sellerTypeHint: toPrismaSellerType(listing.sellerTypeHint),
    sellerClassification: toPrismaSellerType(classification.type),
    sellerConfidence: classification.confidence,
    classificationReasons: classification.reasons,
    leadScore: score.total,
    leadScoreBreakdown: toJsonInput({ components: score.components }),
    status: duplicate !== null ? ('DUPLICATE' as const) : ('ACTIVE' as const),
    duplicateOfId: duplicate?.listingId ?? null,
    duplicateScore: duplicate?.confidence ?? null,
    duplicateReasons: duplicate?.reasons ?? [],
    fingerprint: listing.fingerprint,
    contentHash: listing.contentHash,
    publishedAt: listing.publishedAt,
    lastSeenAt: now,
    scrapedAt: listing.scrapedAt,
    rawPayload: toJsonInput(listing.raw),
  }

  if (existing) {
    // Bekende advertentie. Alleen bijwerken wat echt veranderd is, en de
    // wijziging vastleggen — dat is de historiek waarop het dashboard
    // prijsdalingen toont.
    const unchanged = existing.contentHash === listing.contentHash

    await prisma.listing.update({
      where: { id: existing.id },
      data: unchanged ? { lastSeenAt: now, scrapedAt: listing.scrapedAt } : data,
    })

    if (!unchanged) {
      const history: HistoryEntry[] = []

      if (existing.price !== listing.price) {
        history.push({
          changeType: 'PRICE_CHANGED',
          field: 'price',
          oldValue: existing.price === null ? null : String(existing.price),
          newValue: listing.price === null ? null : String(listing.price),
        })
      }
      if (fromPrismaSellerType(existing.sellerClassification) !== classification.type) {
        history.push({
          changeType: 'SELLER_RECLASSIFIED',
          field: 'sellerClassification',
          oldValue: fromPrismaSellerType(existing.sellerClassification),
          newValue: classification.type,
        })
      }
      if (history.length === 0) {
        history.push({ changeType: 'FIELD_CHANGED', note: 'Inhoud van de advertentie gewijzigd' })
      }

      await recordHistory(existing.id, history)
    }

    if (seller) await refreshSellerListingCount(seller.id)

    return {
      outcome: unchanged ? 'unchanged' : 'updated',
      listingId: existing.id,
      classification,
      leadScore: score.total,
      alertsSent: 0,
      alertsSuppressed: 0,
      qualified: false,
    }
  }

  const created = await prisma.listing.create({
    data: {
      ...data,
      sourceId: options.sourceId,
      sourceListingId: listing.sourceListingId,
      firstSeenAt: now,
    },
    select: { id: true },
  })

  await recordHistory(created.id, [
    { changeType: 'CREATED' },
    ...(duplicate
      ? [
          {
            changeType: 'MARKED_DUPLICATE' as const,
            note: `Duplicaat van ${duplicate.listingId} (${Math.round(duplicate.confidence * 100)}%): ${duplicate.reasons.join(', ')}`,
          },
        ]
      : []),
    ...(relist ? [{ changeType: 'RELISTED' as const, note: 'Lijkt een herplaatsing' }] : []),
  ])

  if (seller) await refreshSellerListingCount(seller.id)

  // ── 6. Alerteren ──────────────────────────────────────────────────────────
  if (duplicate !== null) {
    logger.debug('Duplicaat, geen alert', {
      listingId: created.id,
      duplicateOf: duplicate.listingId,
      confidence: duplicate.confidence,
    })
    return {
      outcome: 'duplicate',
      listingId: created.id,
      classification,
      leadScore: score.total,
      alertsSent: 0,
      alertsSuppressed: 0,
      qualified: false,
    }
  }

  const qualified =
    classification.type === 'private' &&
    classification.confidence >= env.PRIVATE_CONFIDENCE_THRESHOLD &&
    score.total >= env.MIN_LEAD_SCORE

  if (!qualified || options.sendAlerts !== true) {
    return {
      outcome: 'created',
      listingId: created.id,
      classification,
      leadScore: score.total,
      alertsSent: 0,
      alertsSuppressed: 0,
      qualified,
    }
  }

  const candidate: AlertCandidate = {
    listingId: created.id,
    sourceName: options.sourceName,
    url: listing.url,
    postalCode: listing.postalCode,
    city: listing.city,
    province: listing.province,
    latitude: listing.latitude,
    longitude: listing.longitude,
    propertyType: listing.propertyType,
    listingType: listing.listingType,
    price: listing.price,
    currency: listing.currency,
    bedrooms: listing.bedrooms,
    surfaceArea: listing.surfaceArea,
    sellerName: listing.sellerName,
    sellerPhoneE164: listing.sellerPhoneE164,
    sellerClassification: classification.type,
    sellerConfidence: classification.confidence,
    classificationReasons: classification.reasons,
    leadScore: score.total,
    firstSeenAt: now,
    isDuplicate: false,
  }

  const dispatch = await dispatchLead(candidate, { now })

  return {
    outcome: 'created',
    listingId: created.id,
    classification,
    leadScore: score.total,
    alertsSent: dispatch.sent,
    alertsSuppressed: dispatch.suppressed,
    qualified: true,
  }
}

/**
 * Verwerkt een hele collector-oogst.
 *
 * Elke advertentie apart afgeschermd: een bron die één kapotte advertentie
 * teruggeeft levert nog steeds de andere 49 op, en de run wordt PARTIAL in
 * plaats van FAILED.
 */
export async function ingestBatch(
  listings: readonly RawListing[],
  options: IngestOptions,
): Promise<BatchResult> {
  const logger = options.logger ?? defaultLogger
  const territories = await loadActiveTerritories()

  const result: BatchResult = {
    fetched: listings.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    rejected: 0,
    qualified: 0,
    alertsSent: 0,
    alertsSuppressed: 0,
    errors: [],
  }

  for (const raw of listings) {
    try {
      const outcome = await ingestListing(raw, options, territories)

      switch (outcome.outcome) {
        case 'created':
          result.created += 1
          break
        case 'updated':
          result.updated += 1
          break
        case 'unchanged':
          result.unchanged += 1
          break
        case 'duplicate':
          result.duplicates += 1
          break
        case 'rejected':
          result.rejected += 1
          break
      }

      if (outcome.qualified) result.qualified += 1
      result.alertsSent += outcome.alertsSent
      result.alertsSuppressed += outcome.alertsSuppressed
    } catch (error) {
      const message = `${raw.sourceListingId}: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(message)
      logger.error('Advertentie kon niet verwerkt worden', {
        sourceListingId: raw.sourceListingId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}
