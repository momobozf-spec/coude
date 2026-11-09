import 'server-only'

import { Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError } from '@/lib/errors'
import { limitsFor, requireEntitlement, withinLimit } from '@/server/services/entitlements'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

/**
 * Favourites.
 *
 * Two rules that matter:
 *
 *  1. The free cap counts businesses and deals **together**, so "10 saved places"
 *     means what it says rather than twenty.
 *  2. Removing a favourite is always permitted, even over the cap. A member who
 *     downgrades must be able to tidy up; locking them out of deleting their own
 *     data to force an upgrade would be hostile.
 */

export type FavouriteKind = 'BUSINESS' | 'DEAL'

export interface FavouriteCounts {
  businesses: number
  deals: number
  total: number
  limit: number | null
  remaining: number | null
}

export async function getFavouriteCounts(actor: Actor): Promise<FavouriteCounts> {
  const [businesses, deals] = await Promise.all([
    prisma.favoriteBusiness.count({ where: { userId: actor.userId } }),
    prisma.favoriteDeal.count({ where: { userId: actor.userId } }),
  ])

  const limit = limitsFor(actor).maxFavorites
  const total = businesses + deals

  return {
    businesses,
    deals,
    total,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - total),
  }
}

async function assertCapacity(actor: Actor) {
  const counts = await getFavouriteCounts(actor)

  requireEntitlement(actor, 'favorites.unlimited', {
    unless: withinLimit(counts.total, counts.limit),
    message: `The free plan includes ${counts.limit} saved places. Premium removes the limit.`,
  })
}

// ─── Businesses ──────────────────────────────────────────────────────────────

export async function favouriteBusiness(actor: Actor, businessId: string): Promise<boolean> {
  const business = await prisma.business.findFirst({
    where: { id: businessId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true, isDemo: true },
  })
  if (!business) throw new NotFoundError('Business')

  await assertCapacity(actor)

  try {
    await prisma.favoriteBusiness.create({
      data: { userId: actor.userId, businessId: business.id },
    })
  } catch (error) {
    // Unique violation: already saved. Idempotent, not an error — a double tap
    // on a slow connection must not surface a failure.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return true
    }
    throw error
  }

  await track(actor.userId, ANALYTICS_EVENTS.BUSINESS_FAVORITED, { isDemo: business.isDemo })
  return true
}

/** Always allowed, cap or no cap. */
export async function unfavouriteBusiness(actor: Actor, businessId: string): Promise<boolean> {
  await prisma.favoriteBusiness.deleteMany({
    where: { userId: actor.userId, businessId },
  })
  return false
}

export async function toggleFavouriteBusiness(
  actor: Actor,
  businessId: string,
): Promise<boolean> {
  const existing = await prisma.favoriteBusiness.findUnique({
    where: { userId_businessId: { userId: actor.userId, businessId } },
    select: { id: true },
  })

  return existing
    ? unfavouriteBusiness(actor, businessId)
    : favouriteBusiness(actor, businessId)
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export async function favouriteDeal(actor: Actor, dealId: string): Promise<boolean> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null, business: { status: 'PUBLISHED', deletedAt: null } },
    select: { id: true, isDemo: true, isPremiumOnly: true },
  })
  if (!deal) throw new NotFoundError('Deal')

  await assertCapacity(actor)

  try {
    await prisma.favoriteDeal.create({ data: { userId: actor.userId, dealId: deal.id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return true
    }
    throw error
  }

  // Saving a premium deal is allowed on any plan — it is a wishlist, not access.
  await track(actor.userId, ANALYTICS_EVENTS.DEAL_FAVORITED, {
    isDemo: deal.isDemo,
    isPremiumOnly: deal.isPremiumOnly,
  })
  return true
}

export async function unfavouriteDeal(actor: Actor, dealId: string): Promise<boolean> {
  await prisma.favoriteDeal.deleteMany({ where: { userId: actor.userId, dealId } })
  return false
}

export async function toggleFavouriteDeal(actor: Actor, dealId: string): Promise<boolean> {
  const existing = await prisma.favoriteDeal.findUnique({
    where: { userId_dealId: { userId: actor.userId, dealId } },
    select: { id: true },
  })

  return existing ? unfavouriteDeal(actor, dealId) : favouriteDeal(actor, dealId)
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Saved businesses, newest first, with everything a card needs. */
export async function listFavouriteBusinesses(actor: Actor, take = 12) {
  return prisma.favoriteBusiness.findMany({
    where: { userId: actor.userId, business: { status: 'PUBLISHED', deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      createdAt: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          coverImage: true,
          isDemo: true,
          verification: true,
          tier: true,
          category: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
    },
  })
}

export async function listFavouriteDeals(actor: Actor, take = 12) {
  return prisma.favoriteDeal.findMany({
    where: { userId: actor.userId, deal: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      createdAt: true,
      deal: {
        select: {
          id: true,
          title: true,
          discountType: true,
          discountValue: true,
          endsAt: true,
          startsAt: true,
          status: true,
          isPremiumOnly: true,
          isDemo: true,
          business: { select: { name: true, slug: true, city: { select: { name: true } } } },
        },
      },
    },
  })
}
