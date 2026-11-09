/**
 * Data-toegang voor financiering.
 *
 * `FinancingProvider` en `FinancingProduct` zijn redactionele inhoud en dus niet
 * per gebruiker. `FinancingQuote` hangt wél aan een gebruiker en volgt de vaste
 * regel: `userId` als eerste argument, altijd in de WHERE.
 */
import 'server-only'
import {
  FinancingQuoteStatus,
  type FinancingType,
  type Prisma,
  type ShariahAssessmentStatus,
} from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { financingErrors } from './domain/errors'

// ─────────────────────────────────────────────────────────────────────────────
// Aanbieders en producten
// ─────────────────────────────────────────────────────────────────────────────

export type ProductWithProvider = Prisma.FinancingProductGetPayload<{
  include: { provider: true }
}>

export interface ProductFilter {
  country?: string
  financingTypes?: FinancingType[]
  /** Alleen producten van een geverifieerde, niet-verzonnen aanbieder. */
  onlyVerified?: boolean
  /** Sluit voorbeelddata uit. */
  excludeDemo?: boolean
  shariahStatuses?: ShariahAssessmentStatus[]
  /** Producten die passen bij dit aandeel eigen inbreng (in hele procenten). */
  maxOwnContributionPercentage?: number
  /** Producten die deze looptijd toelaten. */
  termMonths?: number
  /** Producten die dit bedrag kunnen financieren, in hele euro's. */
  amount?: number
}

export async function listProducts(filter: ProductFilter = {}): Promise<ProductWithProvider[]> {
  const where: Prisma.FinancingProductWhereInput = {
    active: true,
    ...(filter.country ? { country: filter.country } : {}),
    ...(filter.financingTypes?.length ? { financingType: { in: filter.financingTypes } } : {}),
    ...(filter.shariahStatuses?.length
      ? { shariahAssessmentStatus: { in: filter.shariahStatuses } }
      : {}),
    ...(filter.excludeDemo ? { isDemo: false } : {}),
    ...(filter.onlyVerified ? { isDemo: false, provider: { verified: true } } : {}),
    // Grenzen zijn nullable: een product zonder ondergrens sluit niets uit.
    ...(filter.amount !== undefined
      ? {
          AND: [
            { OR: [{ minAmount: null }, { minAmount: { lte: filter.amount } }] },
            { OR: [{ maxAmount: null }, { maxAmount: { gte: filter.amount } }] },
          ],
        }
      : {}),
    ...(filter.termMonths !== undefined
      ? {
          OR: [
            { termMinMonths: null, termMaxMonths: null },
            {
              AND: [
                { OR: [{ termMinMonths: null }, { termMinMonths: { lte: filter.termMonths } }] },
                { OR: [{ termMaxMonths: null }, { termMaxMonths: { gte: filter.termMonths } }] },
              ],
            },
          ],
        }
      : {}),
    ...(filter.maxOwnContributionPercentage !== undefined
      ? {
          OR: [
            { minOwnContributionPercentage: null },
            { minOwnContributionPercentage: { lte: filter.maxOwnContributionPercentage } },
          ],
        }
      : {}),
  }

  return prisma.financingProduct.findMany({
    where,
    include: { provider: true },
    // Echte aanbieders eerst, dan op naam. Geen ranking op "beste": zie
    // src/modules/financing/domain/comparison.ts.
    orderBy: [{ isDemo: 'asc' }, { name: 'asc' }],
  })
}

export async function findProduct(productId: string): Promise<ProductWithProvider | null> {
  return prisma.financingProduct.findUnique({
    where: { id: productId },
    include: { provider: true },
  })
}

export async function findProductBySlug(slug: string): Promise<ProductWithProvider | null> {
  return prisma.financingProduct.findUnique({
    where: { slug },
    include: { provider: true },
  })
}

export async function requireProduct(productId: string): Promise<ProductWithProvider> {
  const product = await findProduct(productId)
  if (!product) throw financingErrors.productNotFound()
  return product
}

export async function findProductsByIds(ids: readonly string[]): Promise<ProductWithProvider[]> {
  return prisma.financingProduct.findMany({
    where: { id: { in: [...ids] } },
    include: { provider: true },
  })
}

export type ProviderWithProducts = Prisma.FinancingProviderGetPayload<{
  include: { products: true }
}>

export async function listProviders(country?: string) {
  return prisma.financingProvider.findMany({
    where: { active: true, ...(country ? { country } : {}) },
    include: { products: { where: { active: true }, orderBy: { name: 'asc' } } },
    orderBy: [{ isDemo: 'asc' }, { name: 'asc' }],
  })
}

export async function findProvider(providerId: string): Promise<ProviderWithProducts | null> {
  return prisma.financingProvider.findUnique({
    where: { id: providerId },
    include: { products: { where: { active: true }, orderBy: { name: 'asc' } } },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotes — per gebruiker
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteWithRelations = Prisma.FinancingQuoteGetPayload<{
  include: {
    product: { include: { provider: true } }
    property: { select: { id: true; title: true; city: true; imageUrl: true } }
  }
}>

export async function listQuotes(
  userId: string,
  options: { journeyId?: string; propertyId?: string; status?: FinancingQuoteStatus } = {},
): Promise<QuoteWithRelations[]> {
  return prisma.financingQuote.findMany({
    where: {
      userId,
      ...(options.journeyId ? { journeyId: options.journeyId } : {}),
      ...(options.propertyId ? { propertyId: options.propertyId } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    include: {
      product: { include: { provider: true } },
      property: { select: { id: true, title: true, city: true, imageUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** `findFirst` met userId, nooit `findUnique` op id alleen. */
export async function findQuote(
  userId: string,
  quoteId: string,
): Promise<QuoteWithRelations | null> {
  return prisma.financingQuote.findFirst({
    where: { id: quoteId, userId },
    include: {
      product: { include: { provider: true } },
      property: { select: { id: true, title: true, city: true, imageUrl: true } },
    },
  })
}

export async function requireQuote(userId: string, quoteId: string): Promise<QuoteWithRelations> {
  const quote = await findQuote(userId, quoteId)
  if (!quote) throw financingErrors.quoteNotFound()
  return quote
}

export async function createQuote(data: Prisma.FinancingQuoteUncheckedCreateInput) {
  return prisma.financingQuote.create({ data })
}

/**
 * Wijzigt alleen wat een gebruiker mag wijzigen: status en notities.
 *
 * De snapshotvelden staan er bewust niet bij. Een bewaarde berekening hoort niet
 * te veranderen — dat is het hele punt van een snapshot. Wie een andere
 * berekening wil, maakt een nieuwe quote.
 */
export async function updateQuoteMeta(
  userId: string,
  quoteId: string,
  data: { status?: FinancingQuoteStatus; notes?: string | null },
): Promise<void> {
  const result = await prisma.financingQuote.updateMany({
    where: { id: quoteId, userId },
    data,
  })
  if (result.count === 0) throw financingErrors.quoteNotFound()
}

export async function deleteQuote(userId: string, quoteId: string): Promise<void> {
  const result = await prisma.financingQuote.deleteMany({ where: { id: quoteId, userId } })
  if (result.count === 0) throw financingErrors.quoteNotFound()
}

export async function countQuotes(userId: string, journeyId?: string): Promise<number> {
  return prisma.financingQuote.count({
    where: { userId, ...(journeyId ? { journeyId } : {}) },
  })
}

/**
 * Hoeveel verschillende producten heeft deze gebruiker doorgerekend?
 *
 * Dit is het objectieve gegeven achter "heb ik financieringsvormen vergeleken".
 * Zie `journeyEvidence` in de service.
 */
export async function countDistinctComparedProducts(
  userId: string,
  journeyId?: string,
): Promise<number> {
  const rows = await prisma.financingQuote.findMany({
    where: { userId, productId: { not: null }, ...(journeyId ? { journeyId } : {}) },
    select: { productId: true },
    distinct: ['productId'],
  })
  return rows.length
}

export { FinancingQuoteStatus }
