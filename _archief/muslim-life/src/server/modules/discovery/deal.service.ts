import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError } from '@/lib/errors'
import { hasEntitlement } from '@/server/services/entitlements'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import type { DealFilter } from '@/server/modules/discovery/discovery.schema'
import type { PagedResult } from '@/server/modules/discovery/business.service'

/**
 * Deals.
 *
 * One rule decides whether a deal is live, and everything reads it from here:
 *
 *     status === 'ACTIVE' && startsAt <= now <= endsAt && not deleted
 *
 * Both the SQL predicate and the in-memory check below derive from that single
 * definition, so a deal can never look live on a list and dead on its detail page.
 */

export interface DealSummary {
  id: string
  title: string
  description: string
  image: string | null
  discountType: 'PERCENTAGE' | 'FIXED' | 'BOGO' | 'FREEBIE'
  discountValue: number
  benefitLabel: string
  startsAt: Date
  endsAt: Date
  isPremiumOnly: boolean
  isDemo: boolean
  status: string
  /** Live right now, by the rule above. */
  isActive: boolean
  isExpired: boolean
  isUpcoming: boolean
  businessId: string
  businessName: string
  businessSlug: string
  cityName: string
  categoryName: string
  isFavourite: boolean
  /** Whether this member may redeem it — entitlement resolved server-side. */
  canRedeem: boolean
  lockedReason: 'PREMIUM' | 'EXPIRED' | 'UPCOMING' | 'SOLD_OUT' | null
}

export interface DealDetail extends DealSummary {
  terms: string | null
  maxRedemptions: number | null
  redemptionCount: number
  businessAddress: string
  businessPhone: string | null
  /** Present only when this member already holds a redemption. */
  redemption: { code: string; status: string; issuedAt: Date; expiresAt: Date | null } | null
}

/**
 * Columns for a deal card or page.
 *
 * `code` — the business-wide promo code — is deliberately absent. It is a
 * benefit of redeeming and is only ever released through the redemption service,
 * never bundled into a response that a free member could read from the network tab.
 */
const DEAL_SELECT = {
  id: true,
  title: true,
  description: true,
  image: true,
  discountType: true,
  discountValue: true,
  startsAt: true,
  endsAt: true,
  isPremiumOnly: true,
  isDemo: true,
  status: true,
  maxRedemptions: true,
  redemptionCount: true,
  priority: true,
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      phone: true,
      city: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.DealSelect

type DealRow = Prisma.DealGetPayload<{ select: typeof DEAL_SELECT }>

/** The single SQL definition of "currently redeemable". */
export function activeDealWhere(now: Date): Prisma.DealWhereInput {
  return {
    status: 'ACTIVE',
    deletedAt: null,
    startsAt: { lte: now },
    endsAt: { gte: now },
    business: { status: 'PUBLISHED', deletedAt: null },
  }
}

/** The same rule, in memory, for a row already loaded. */
export function isDealActive(
  deal: { status: string; startsAt: Date; endsAt: Date },
  now: Date = new Date(),
): boolean {
  return deal.status === 'ACTIVE' && deal.startsAt <= now && deal.endsAt >= now
}

export function formatBenefit(
  discountType: string,
  discountValue: number,
  currencySymbol = '€',
): string {
  switch (discountType) {
    case 'PERCENTAGE':
      return `${discountValue}% off`
    case 'FIXED':
      return `${currencySymbol}${(discountValue / 100).toFixed(2)} off`
    case 'BOGO':
      return 'Buy one, get one'
    case 'FREEBIE':
      return 'Free item'
    default:
      return 'Member offer'
  }
}

function toSummary(
  row: DealRow,
  options: { actor: Actor; favourites: Set<string>; now: Date },
): DealSummary {
  const active = isDealActive(row, options.now)
  const expired = row.status === 'EXPIRED' || row.endsAt < options.now
  const upcoming = row.startsAt > options.now
  const soldOut = row.maxRedemptions !== null && row.redemptionCount >= row.maxRedemptions

  const premiumBlocked = row.isPremiumOnly && !hasEntitlement(options.actor, 'deals.premium')

  const lockedReason: DealSummary['lockedReason'] = expired
    ? 'EXPIRED'
    : upcoming
      ? 'UPCOMING'
      : premiumBlocked
        ? 'PREMIUM'
        : soldOut
          ? 'SOLD_OUT'
          : null

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image,
    discountType: row.discountType,
    discountValue: row.discountValue,
    benefitLabel: formatBenefit(row.discountType, row.discountValue),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isPremiumOnly: row.isPremiumOnly,
    isDemo: row.isDemo,
    status: row.status,
    isActive: active,
    isExpired: expired,
    isUpcoming: upcoming,
    businessId: row.business.id,
    businessName: row.business.name,
    businessSlug: row.business.slug,
    cityName: row.business.city.name,
    categoryName: row.business.category.name,
    isFavourite: options.favourites.has(row.id),
    canRedeem: active && lockedReason === null,
    lockedReason,
  }
}

export async function browseDeals(
  actor: Actor,
  filter: DealFilter,
  now: Date = new Date(),
): Promise<PagedResult<DealSummary>> {
  const favouriteIds = filter.favourites ? await listFavouriteDealIds(actor) : null

  const where: Prisma.DealWhereInput = filter.includeExpired
    ? {
        deletedAt: null,
        status: { in: ['ACTIVE', 'EXPIRED'] },
        business: { status: 'PUBLISHED', deletedAt: null },
      }
    : activeDealWhere(now)

  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: 'insensitive' } },
      { business: { name: { contains: filter.q, mode: 'insensitive' } } },
    ]
  }

  if (filter.city || filter.category) {
    where.business = {
      ...(where.business as Prisma.BusinessWhereInput),
      ...(filter.city ? { city: { slug: filter.city } } : {}),
      ...(filter.category ? { category: { slug: filter.category } } : {}),
    }
  }

  if (favouriteIds !== null) where.id = { in: favouriteIds }

  const skip = (filter.page - 1) * filter.pageSize

  const [total, rows] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where,
      // Sponsored priority first, then the soonest to expire — which is the
      // genuinely useful ordering for the member, not just for us.
      orderBy: [{ priority: 'desc' }, { endsAt: 'asc' }, { id: 'asc' }],
      skip,
      take: filter.pageSize,
      select: DEAL_SELECT,
    }),
  ])

  const favourites = await favouriteSet(actor, rows.map((row) => row.id))
  const items = rows.map((row) => toSummary(row, { actor, favourites, now }))

  return {
    items,
    page: filter.page,
    pageSize: filter.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    hasPrevious: filter.page > 1,
    hasNext: skip + rows.length < total,
  }
}

export async function getDealById(
  actor: Actor,
  dealId: string,
  now: Date = new Date(),
): Promise<DealDetail> {
  const row = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null, business: { status: 'PUBLISHED', deletedAt: null } },
    select: { ...DEAL_SELECT, terms: true },
  })

  if (!row) throw new NotFoundError('Deal')

  const [favourites, existing] = await Promise.all([
    favouriteSet(actor, [row.id]),
    // Only this member's own redemption is ever read.
    prisma.dealRedemption.findUnique({
      where: { dealId_userId: { dealId: row.id, userId: actor.userId } },
      select: { code: true, status: true, issuedAt: true, expiresAt: true },
    }),
  ])

  const summary = toSummary(row, { actor, favourites, now })

  await track(actor.userId, ANALYTICS_EVENTS.DEAL_OPENED, {
    isPremiumOnly: row.isPremiumOnly,
    isDemo: row.isDemo,
    locked: summary.lockedReason !== null,
  })

  return {
    ...summary,
    terms: row.terms,
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    businessAddress: row.business.address,
    businessPhone: row.business.phone,
    redemption: existing,
  }
}

/** Active deals for one business, used on the business detail page. */
export async function listDealsForBusiness(
  actor: Actor,
  businessId: string,
  now: Date = new Date(),
): Promise<DealSummary[]> {
  const rows = await prisma.deal.findMany({
    where: { ...activeDealWhere(now), businessId },
    orderBy: [{ priority: 'desc' }, { endsAt: 'asc' }],
    select: DEAL_SELECT,
  })

  const favourites = await favouriteSet(actor, rows.map((row) => row.id))
  return rows.map((row) => toSummary(row, { actor, favourites, now }))
}

async function favouriteSet(actor: Actor, dealIds: string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set()

  const rows = await prisma.favoriteDeal.findMany({
    where: { userId: actor.userId, dealId: { in: dealIds } },
    select: { dealId: true },
  })

  return new Set(rows.map((row) => row.dealId))
}

async function listFavouriteDealIds(actor: Actor): Promise<string[]> {
  const rows = await prisma.favoriteDeal.findMany({
    where: { userId: actor.userId },
    select: { dealId: true },
  })
  return rows.map((row) => row.dealId)
}
