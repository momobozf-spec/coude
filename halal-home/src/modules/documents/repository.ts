/**
 * Data-toegang voor documenten.
 *
 * DE REGEL, strenger hier dan waar ook: elke functie neemt `userId` als eerste
 * argument en gebruikt hem in de WHERE-clausule. Dit zijn identiteitskaarten en
 * loonfiches; een ontbrekende filter is hier geen bug maar een datalek.
 *
 * Geen enkele functie hier accepteert een `storageKey` van buitenaf. De sleutel
 * komt altijd uit een rij die op `userId` gevonden is — anders zou een geraden
 * sleutel genoeg zijn.
 */
import 'server-only'
import { DocumentStatus, type DocumentCategory, type Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { documentErrors } from './domain/errors'

export type DocumentRow = Prisma.DocumentGetPayload<{
  include: {
    property: { select: { id: true; title: true; city: true } }
    financingQuote: { select: { id: true; productName: true; providerName: true } }
  }
}>

const RELATIONS = {
  property: { select: { id: true, title: true, city: true } },
  financingQuote: { select: { id: true, productName: true, providerName: true } },
} as const

export interface DocumentFilter {
  category?: DocumentCategory
  journeyId?: string
  propertyId?: string
  /** Standaard verbergen we verwijderde documenten. */
  includeDeleted?: boolean
}

export async function listDocuments(
  userId: string,
  filter: DocumentFilter = {},
): Promise<DocumentRow[]> {
  return prisma.document.findMany({
    where: {
      userId,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.journeyId ? { journeyId: filter.journeyId } : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
      ...(filter.includeDeleted ? {} : { status: { not: DocumentStatus.DELETED } }),
    },
    include: RELATIONS,
    orderBy: { uploadedAt: 'desc' },
  })
}

/** `findFirst` met userId, nooit `findUnique` op id alleen. */
export async function findDocument(
  userId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  return prisma.document.findFirst({
    where: { id: documentId, userId },
    include: RELATIONS,
  })
}

export async function requireDocument(
  userId: string,
  documentId: string,
): Promise<DocumentRow> {
  const document = await findDocument(userId, documentId)
  // 404 en niet 403, ook wanneer het document bestaat maar van iemand anders
  // is: het bestaan zelf is al informatie.
  if (!document) throw documentErrors.notFound()
  return document
}

/**
 * Wordt gegooid wanneer de unique index op `(userId, idempotencyKey)` een
 * tweede rij tegenhoudt. Dat is geen storing maar het verwachte resultaat van
 * twee gelijktijdige verzoeken met dezelfde sleutel: de service vertaalt hem
 * naar het document van de winnaar.
 */
export class IdempotencyConflictError extends Error {
  constructor() {
    super('Er loopt al een upload met deze idempotency key.')
    this.name = 'IdempotencyConflictError'
  }
}

export async function createPending(
  data: Prisma.DocumentUncheckedCreateInput,
): Promise<{ id: string; storageKey: string }> {
  try {
    return await prisma.document.create({
      data: { ...data, status: DocumentStatus.PENDING },
      select: { id: true, storageKey: true },
    })
  } catch (error) {
    if (isUniqueViolationOn(error, 'idempotencyKey')) throw new IdempotencyConflictError()
    throw error
  }
}

function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    (error as { code?: unknown }).code !== 'P2002'
  ) {
    return false
  }

  // Prisma levert de betrokken kolommen aan als `meta.target`. Bij een raw
  // driver-fout kan die ontbreken; dan vallen we terug op de indexnaam in de
  // boodschap, zodat we een botsing op een ándere unique niet stilzwijgend als
  // replay behandelen.
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) return target.includes(field)
  if (typeof target === 'string') return target.includes(field)
  return false
}

export async function markAvailable(
  userId: string,
  documentId: string,
  data: { sizeBytes: number; checksum: string },
): Promise<void> {
  const result = await prisma.document.updateMany({
    where: { id: documentId, userId },
    data: { ...data, status: DocumentStatus.AVAILABLE, failureReason: null },
  })
  if (result.count === 0) throw documentErrors.notFound()
}

/**
 * Markeert de upload als mislukt.
 *
 * Geen `userId`-filter: dit wordt aangeroepen in een `catch` waarin de rij
 * zojuist door ons is aangemaakt, en het niet kunnen wegschrijven van de reden
 * zou de oorspronkelijke fout maskeren.
 */
export async function markFailed(documentId: string, reason: string): Promise<void> {
  await prisma.document.updateMany({
    where: { id: documentId },
    data: { status: DocumentStatus.FAILED, failureReason: reason.slice(0, 500) },
  })
}

export async function markDeleted(
  userId: string,
  documentId: string,
  purged: boolean,
): Promise<void> {
  const now = new Date()
  const result = await prisma.document.updateMany({
    where: { id: documentId, userId },
    data: {
      status: DocumentStatus.DELETED,
      deletedAt: now,
      // Alleen zetten wanneer het wissen werkelijk gelukt is. Blijft dit leeg,
      // dan pikt de opruimtaak het later opnieuw op.
      ...(purged ? { purgedAt: now } : {}),
    },
  })
  if (result.count === 0) throw documentErrors.notFound()
}

export async function markPurged(documentId: string): Promise<void> {
  await prisma.document.updateMany({
    where: { id: documentId },
    data: { purgedAt: new Date() },
  })
}

export async function updateMetadata(
  userId: string,
  documentId: string,
  data: { displayName?: string; description?: string | null; expiresAt?: Date | null },
): Promise<void> {
  const result = await prisma.document.updateMany({ where: { id: documentId, userId }, data })
  if (result.count === 0) throw documentErrors.notFound()
}

/**
 * Koppelt een document aan een woning, een quote of een checklist-item.
 *
 * De aanroeper controleert eerst of het doel van deze gebruiker is; deze functie
 * doet alleen de schrijfactie — mét de userId-filter, zodat een fout in die
 * volgorde geen gat oplevert.
 */
export async function updateLinks(
  userId: string,
  documentId: string,
  links: {
    propertyId?: string | null
    financingQuoteId?: string | null
    journeyId?: string | null
    checklistItemKey?: string | null
  },
): Promise<void> {
  const result = await prisma.document.updateMany({ where: { id: documentId, userId }, data: links })
  if (result.count === 0) throw documentErrors.notFound()
}

export async function countByCategory(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.document.groupBy({
    by: ['category'],
    where: { userId, status: DocumentStatus.AVAILABLE },
    _count: { _all: true },
  })

  return Object.fromEntries(rows.map((row) => [row.category, row._count._all]))
}

/**
 * Zoekt de eerdere uitvoering van dezelfde uploadhandeling.
 *
 * Let op het verschil met `findByChecksum`: die vindt dezelfde *inhoud*, dit
 * vindt dezelfde *handeling*. Alleen deze mag een tweede document verhinderen.
 *
 * Geen statusfilter. Een replay moet ook een PENDING of FAILED poging
 * terugvinden — juist dan is er iets misgegaan en probeert de client opnieuw.
 */
export async function findByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<{ id: string; storageKey: string; status: DocumentStatus } | null> {
  return prisma.document.findFirst({
    where: { userId, idempotencyKey },
    select: { id: true, storageKey: true, status: true },
  })
}

/** Bestaat er al een document met deze inhoud? Puur informatief. */
export async function findByChecksum(
  userId: string,
  checksum: string,
): Promise<{ id: string; displayName: string | null; originalFilename: string } | null> {
  return prisma.document.findFirst({
    where: { userId, checksum, status: DocumentStatus.AVAILABLE },
    select: { id: true, displayName: true, originalFilename: true },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Opruimen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Documenten die opgeruimd moeten worden.
 *
 * Systeembreed, niet per gebruiker: dit is een onderhoudstaak. Hij wordt niet
 * vanuit een gebruikersroute aangeroepen — zie `purgeOrphans()` in de service.
 */
export async function listCleanupCandidates(limit = 100) {
  return prisma.document.findMany({
    where: {
      OR: [
        { deletedAt: { not: null }, purgedAt: null },
        { status: DocumentStatus.PENDING },
      ],
    },
    select: {
      id: true,
      storageKey: true,
      status: true,
      deletedAt: true,
      purgedAt: true,
      createdAt: true,
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Uitleg
// ─────────────────────────────────────────────────────────────────────────────

export async function listExplanations(userId: string, documentId: string) {
  return prisma.documentExplanation.findMany({
    where: { documentId, userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function latestExplanation(userId: string, documentId: string) {
  return prisma.documentExplanation.findFirst({
    where: { documentId, userId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Elke uitleg is een nieuwe rij, nooit een update.
 *
 * Zo blijft zichtbaar dát er opnieuw gegenereerd is, en overschrijft een nieuwe
 * uitleg nooit een oude.
 */
export async function createExplanation(data: Prisma.DocumentExplanationUncheckedCreateInput) {
  return prisma.documentExplanation.create({ data })
}

export { DocumentStatus }
