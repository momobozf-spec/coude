/**
 * Alle database-toegang tot advertenties, verkopers en hun geschiedenis.
 *
 * De pijplijn (`ingestionService`) doet de logica en roept hier de opslag aan.
 * Die scheiding is niet cosmetisch: de logica wordt getest zonder database, en
 * elke query staat op één plek waar hij te lezen en te indexeren is.
 */
import type { Prisma, ListingType, SellerType, ListingStatus } from '@prisma/client'

import type { DuplicateCandidate, NormalizedListing } from '@/domain/types'

import { prisma } from './prisma'

/** Prisma-enums en domeinwaarden vertalen. Het domein spreekt kleine letters. */
export function toPrismaListingType(value: 'sale' | 'rent' | null): ListingType | null {
  if (value === 'sale') return 'SALE'
  if (value === 'rent') return 'RENT'
  return null
}

export function fromPrismaListingType(value: ListingType | null): 'sale' | 'rent' | null {
  if (value === 'SALE') return 'sale'
  if (value === 'RENT') return 'rent'
  return null
}

export function toPrismaSellerType(value: 'private' | 'professional' | 'unknown'): SellerType {
  if (value === 'private') return 'PRIVATE'
  if (value === 'professional') return 'PROFESSIONAL'
  return 'UNKNOWN'
}

export function fromPrismaSellerType(value: SellerType): 'private' | 'professional' | 'unknown' {
  if (value === 'PRIVATE') return 'private'
  if (value === 'PROFESSIONAL') return 'professional'
  return 'unknown'
}

export async function findBySourceListingId(
  sourceId: string,
  sourceListingId: string,
): Promise<Prisma.ListingGetPayload<{ include: { seller: true } }> | null> {
  return prisma.listing.findUnique({
    where: { sourceId_sourceListingId: { sourceId, sourceListingId } },
    include: { seller: true },
  })
}

/**
 * Kandidaten voor cross-source deduplicatie.
 *
 * ─── DRIE ZOEKSTRATEGIEËN, GEEN ─────────────────────────────────────────────
 *
 * De vingerafdruk is een blokkeersleutel met harde grenzen: een woning van
 * 94 m² en dezelfde woning die elders als 96 m² staat vallen in verschillende
 * buckets. Zou de vingerafdruk de enige ingang zijn, dan miste dat de match.
 *
 * Daarom drie ingangen naast elkaar, die elkaars blinde vlekken dekken:
 *
 *   1. telefoonnummer  — het scherpst, maar vaak niet beschikbaar
 *   2. vingerafdruk    — snel, mist randgevallen
 *   3. postcode + prijsvenster — traag maar breed, vangt de rest
 *
 * De resultaten worden samengevoegd en ontdubbeld; `findBestDuplicate` beslist.
 * De limiet per strategie houdt de kosten begrensd, ook in een postcode met
 * veel aanbod.
 */
export async function findDuplicateCandidates(
  listing: NormalizedListing,
  options: { excludeSourceId: string; limit?: number } ,
): Promise<DuplicateCandidate[]> {
  const limit = options.limit ?? 25

  const select = {
    id: true,
    sourceListingId: true,
    title: true,
    description: true,
    price: true,
    postalCode: true,
    address: true,
    surfaceArea: true,
    bedrooms: true,
    source: { select: { key: true } },
    seller: { select: { phoneE164: true } },
  } satisfies Prisma.ListingSelect

  const notDeleted = {
    status: { in: ['ACTIVE', 'DUPLICATE'] as ListingStatus[] },
    // Een advertentie uit dezelfde bron is per definitie geen cross-source
    // duplicaat; die relatie loopt via `source + sourceListingId`.
    sourceId: { not: options.excludeSourceId },
  }

  const queries: Prisma.PrismaPromise<Prisma.ListingGetPayload<{ select: typeof select }>[]>[] = []

  if (listing.sellerPhoneE164) {
    queries.push(
      prisma.listing.findMany({
        where: { ...notDeleted, seller: { phoneE164: listing.sellerPhoneE164 } },
        select,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
      }),
    )
  }

  if (listing.fingerprint) {
    queries.push(
      prisma.listing.findMany({
        where: { ...notDeleted, fingerprint: listing.fingerprint },
        select,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
      }),
    )
  }

  if (listing.postalCode) {
    // ±10% prijsvenster: ruim genoeg voor een verkoper die zijn vraagprijs
    // tussen twee sites afrondt, smal genoeg om niet de halve gemeente op te
    // halen. Zonder prijs vervalt het venster en vertrouwen we op de andere
    // twee strategieën plus de scoredrempel.
    const priceWindow =
      listing.price === null
        ? {}
        : {
            price: {
              gte: Math.floor(listing.price * 0.9),
              lte: Math.ceil(listing.price * 1.1),
            },
          }

    queries.push(
      prisma.listing.findMany({
        where: { ...notDeleted, postalCode: listing.postalCode, ...priceWindow },
        select,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
      }),
    )
  }

  if (queries.length === 0) return []

  const results = await prisma.$transaction(queries)
  const byId = new Map<string, DuplicateCandidate>()

  for (const rows of results) {
    for (const row of rows) {
      if (byId.has(row.id)) continue
      byId.set(row.id, {
        id: row.id,
        source: row.source.key,
        sourceListingId: row.sourceListingId,
        title: row.title,
        description: row.description,
        price: row.price,
        postalCode: row.postalCode,
        address: row.address,
        surfaceArea: row.surfaceArea,
        bedrooms: row.bedrooms,
        sellerPhoneE164: row.seller?.phoneE164 ?? null,
        fingerprint: null,
      })
    }
  }

  return [...byId.values()]
}

export interface SellerUpsertInput {
  displayName: string | null
  phoneE164: string | null
  classification: 'private' | 'professional' | 'unknown'
  confidence: number
  reasons: string[]
}

/**
 * Zoekt of maakt de verkoper.
 *
 * ─── WANNEER ZIJN TWEE ADVERTENTIES VAN DEZELFDE VERKOPER? ───────────────────
 *
 * Alleen bij een identiek telefoonnummer. Een naam is te zwak: "Jan Peeters"
 * is in België geen identificatie, en twee advertenties samenvoegen op naam zou
 * betekenen dat de ene Jan de listingteller van de andere opdrijft, waarna
 * beiden ten onrechte als professional gelden.
 *
 * Zonder telefoonnummer krijgt elke advertentie dus zijn eigen Seller-rij. Dat
 * is bewust: liever twee rijen voor één persoon dan één rij voor twee personen.
 */
export async function upsertSeller(
  input: SellerUpsertInput,
  now: Date,
): Promise<{ id: string; previousClassification: 'private' | 'professional' | 'unknown' | null; activeListingCount: number }> {
  if (input.phoneE164) {
    const existing = await prisma.seller.findUnique({ where: { phoneE164: input.phoneE164 } })

    if (existing) {
      const updated = await prisma.seller.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName ?? existing.displayName,
          classification: toPrismaSellerType(input.classification),
          confidence: input.confidence,
          reasons: input.reasons,
          lastSeenAt: now,
        },
      })
      return {
        id: updated.id,
        previousClassification: fromPrismaSellerType(existing.classification),
        activeListingCount: existing.activeListingCount,
      }
    }
  }

  const created = await prisma.seller.create({
    data: {
      displayName: input.displayName,
      phoneE164: input.phoneE164,
      classification: toPrismaSellerType(input.classification),
      confidence: input.confidence,
      reasons: input.reasons,
      firstSeenAt: now,
      lastSeenAt: now,
      activeListingCount: 0,
    },
  })

  return { id: created.id, previousClassification: null, activeListingCount: 0 }
}

/** Hoeveel actieve advertenties heeft deze verkoper? Voedt de classificatie. */
export async function countActiveListingsForSeller(sellerId: string): Promise<number> {
  return prisma.listing.count({ where: { sellerId, status: 'ACTIVE' } })
}

export async function refreshSellerListingCount(sellerId: string): Promise<number> {
  const count = await countActiveListingsForSeller(sellerId)
  await prisma.seller.update({ where: { id: sellerId }, data: { activeListingCount: count } })
  return count
}

export interface HistoryEntry {
  changeType: Prisma.ListingHistoryCreateManyInput['changeType']
  field?: string
  oldValue?: string | null
  newValue?: string | null
  note?: string
}

export async function recordHistory(
  listingId: string,
  entries: readonly HistoryEntry[],
): Promise<void> {
  if (entries.length === 0) return

  await prisma.listingHistory.createMany({
    data: entries.map((entry) => ({ ...entry, listingId })),
  })
}
