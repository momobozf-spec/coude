/**
 * Data-toegang voor zoekopdrachten en panden.
 *
 * `PropertySearch`, `SavedProperty` en `PropertyMatch` hangen aan een gebruiker
 * en volgen dus de vaste regel: `userId` als eerste argument, altijd in de
 * WHERE. `Property` is globaal — één woning bestaat één keer, ongeacht hoeveel
 * gebruikers hem vinden.
 */
import 'server-only'
import { Prisma, SearchFrequency, type SavedPropertyStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { NotFoundError } from '@/lib/errors'
import type { NormalizedProperty } from '@/modules/property/domain/normalize'

// ─────────────────────────────────────────────────────────────────────────────
// Zoekopdrachten
// ─────────────────────────────────────────────────────────────────────────────

export async function listSearches(userId: string) {
  return prisma.propertySearch.findMany({
    where: { userId },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    include: { _count: { select: { matches: true } } },
  })
}

export async function findSearch(userId: string, searchId: string) {
  return prisma.propertySearch.findFirst({ where: { id: searchId, userId } })
}

export async function requireSearch(userId: string, searchId: string) {
  const search = await findSearch(userId, searchId)
  // NotFound en niet Forbidden: wie geen toegang heeft, hoort niet te kunnen
  // afleiden dát de zoekopdracht bestaat.
  if (!search) throw new NotFoundError('Zoekopdracht niet gevonden')
  return search
}

export async function countActiveSearches(userId: string): Promise<number> {
  return prisma.propertySearch.count({ where: { userId, active: true } })
}

export interface CreateSearchInput {
  name: string
  originalQuery: string
  criteria: Prisma.InputJsonValue
  criteriaVersion: number
  journeyId?: string | null
  frequency?: SearchFrequency
  alertsEnabled?: boolean
}

export async function createSearch(userId: string, input: CreateSearchInput) {
  return prisma.propertySearch.create({
    data: {
      userId,
      name: input.name,
      originalQuery: input.originalQuery,
      criteria: input.criteria,
      criteriaVersion: input.criteriaVersion,
      journeyId: input.journeyId ?? null,
      frequency: input.frequency ?? SearchFrequency.DAILY,
      alertsEnabled: input.alertsEnabled ?? true,
    },
  })
}

export async function updateSearch(
  userId: string,
  searchId: string,
  data: Prisma.PropertySearchUpdateManyMutationInput,
) {
  const result = await prisma.propertySearch.updateMany({
    where: { id: searchId, userId },
    data,
  })
  if (result.count === 0) throw new NotFoundError('Zoekopdracht niet gevonden')
}

export async function deleteSearch(userId: string, searchId: string): Promise<void> {
  const result = await prisma.propertySearch.deleteMany({ where: { id: searchId, userId } })
  if (result.count === 0) throw new NotFoundError('Zoekopdracht niet gevonden')
}

// ─────────────────────────────────────────────────────────────────────────────
// Panden — globaal, niet per gebruiker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * De bestaande panden waartegen we deze batch ontdubbelen.
 *
 * Bewust alleen de velden die de deduplicatie nodig heeft, en gefilterd op de
 * sleutels uit de batch: de hele pandentabel ophalen om drie duplicaten te
 * vinden schaalt niet.
 */
export async function findExistingForDedupe(candidates: readonly NormalizedProperty[]) {
  if (candidates.length === 0) return []

  return prisma.property.findMany({
    where: {
      OR: [
        {
          AND: [
            { source: { in: [...new Set(candidates.map((c) => c.source))] } },
            { externalId: { in: candidates.map((c) => c.externalId) } },
          ],
        },
        { urlNormalized: { in: candidates.map((c) => c.urlNormalized) } },
        { fingerprint: { in: candidates.map((c) => c.fingerprint) } },
      ],
    },
    select: {
      id: true,
      source: true,
      externalId: true,
      urlNormalized: true,
      fingerprint: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      livingAreaM2: true,
      landAreaM2: true,
      epcLabel: true,
      title: true,
    },
  })
}

export async function createProperty(property: NormalizedProperty) {
  return prisma.property.create({
    data: {
      ...property,
      discoveredAt: new Date(),
      lastSeenAt: new Date(),
    },
    select: { id: true },
  })
}

/**
 * Werkt een bestaand pand bij en legt de wijzigingen vast.
 *
 * `lastSeenAt` altijd; `delistedAt` op null omdat het pand kennelijk weer
 * zichtbaar is. Een pand dat terugkomt na een periode van afwezigheid, is geen
 * nieuw pand.
 */
export async function updateProperty(
  propertyId: string,
  property: NormalizedProperty,
  changes: readonly { field: string; oldValue: string | null; newValue: string | null }[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        title: property.title,
        description: property.description,
        price: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        livingAreaM2: property.livingAreaM2,
        landAreaM2: property.landAreaM2,
        epcLabel: property.epcLabel,
        epcValue: property.epcValue,
        features: property.features,
        imageUrl: property.imageUrl,
        latitude: property.latitude,
        longitude: property.longitude,
        lastSeenAt: new Date(),
        delistedAt: null,
      },
    })

    if (changes.length > 0) {
      await tx.propertyHistory.createMany({
        data: changes.map((change) => ({ propertyId, ...change })),
      })
    }
  })
}

export async function findPropertyById(propertyId: string) {
  return prisma.property.findUnique({ where: { id: propertyId } })
}

export async function findPropertiesByIds(ids: readonly string[]) {
  return prisma.property.findMany({ where: { id: { in: [...ids] } } })
}

/** De prijshistoriek van één pand. Voor "€12.000 gedaald sinds je hem bewaarde". */
export async function priceHistory(propertyId: string, limit = 10) {
  return prisma.propertyHistory.findMany({
    where: { propertyId, field: 'price' },
    orderBy: { changedAt: 'desc' },
    take: limit,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Matches
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchUpsert {
  searchId: string
  propertyId: string
  userId: string
  score: number
  hardPass: boolean
  reasons: Prisma.InputJsonValue
}

/**
 * Slaat matches op. Bestaande matches worden bijgewerkt, niet gedupliceerd.
 *
 * De unique constraint op (searchId, propertyId) is wat "geen twee meldingen
 * voor hetzelfde pand" afdwingt.
 */
export async function upsertMatches(matches: readonly MatchUpsert[]): Promise<number> {
  let created = 0

  for (const match of matches) {
    const result = await prisma.propertyMatch.upsert({
      where: {
        searchId_propertyId: { searchId: match.searchId, propertyId: match.propertyId },
      },
      create: match,
      update: { score: match.score, hardPass: match.hardPass, reasons: match.reasons },
      select: { createdAt: true, updatedAt: true },
    })

    // createdAt === updatedAt betekent dat deze rij zojuist is aangemaakt.
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
  }

  return created
}

export async function listMatches(
  userId: string,
  options: { searchId?: string; onlyPassing?: boolean; limit?: number } = {},
) {
  return prisma.propertyMatch.findMany({
    where: {
      userId,
      ...(options.searchId ? { searchId: options.searchId } : {}),
      ...(options.onlyPassing ? { hardPass: true } : {}),
    },
    include: { property: true },
    orderBy: [{ hardPass: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }],
    take: options.limit ?? 50,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

export async function startRun(searchId: string) {
  return prisma.searchRun.create({ data: { searchId }, select: { id: true } })
}

export async function finishRun(
  runId: string,
  data: {
    status: 'COMPLETED' | 'FAILED'
    fetchedCount: number
    newPropertyCount: number
    matchCount: number
    sourceStats?: Prisma.InputJsonValue
    error?: string
  },
): Promise<void> {
  await prisma.searchRun.update({
    where: { id: runId },
    data: { ...data, finishedAt: new Date() },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Bewaarde panden
// ─────────────────────────────────────────────────────────────────────────────

export async function listSavedProperties(
  userId: string,
  options: { status?: SavedPropertyStatus; journeyId?: string } = {},
) {
  return prisma.savedProperty.findMany({
    where: {
      userId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.journeyId ? { journeyId: options.journeyId } : {}),
    },
    include: { property: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function findSavedProperty(userId: string, propertyId: string) {
  return prisma.savedProperty.findFirst({ where: { userId, propertyId } })
}

export async function saveProperty(
  userId: string,
  propertyId: string,
  data: { journeyId?: string | null; status?: SavedPropertyStatus; priceAtSave?: number | null },
) {
  return prisma.savedProperty.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId, ...data },
    update: { ...(data.status ? { status: data.status } : {}) },
  })
}

export async function updateSavedProperty(
  userId: string,
  propertyId: string,
  data: { status?: SavedPropertyStatus; notes?: string | null; rating?: number | null },
): Promise<void> {
  const result = await prisma.savedProperty.updateMany({
    where: { userId, propertyId },
    data,
  })
  if (result.count === 0) throw new NotFoundError('Woning niet gevonden in je lijst')
}

export async function unsaveProperty(userId: string, propertyId: string): Promise<void> {
  const result = await prisma.savedProperty.deleteMany({ where: { userId, propertyId } })
  if (result.count === 0) throw new NotFoundError('Woning niet gevonden in je lijst')
}

export async function countSavedProperties(userId: string): Promise<number> {
  return prisma.savedProperty.count({ where: { userId } })
}
