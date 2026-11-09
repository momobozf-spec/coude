import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError } from '@/lib/errors'
import { calculateDistanceKm, type Coordinates } from '@/lib/geo/distance'
import {
  getBusinessOpenState,
  parseOpeningHours,
  type OpenState,
  type OpeningHours,
} from '@/lib/business/opening-hours'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import type { BusinessFilter } from '@/server/modules/discovery/discovery.schema'

/**
 * Business discovery.
 *
 * Filtering and pagination happen in PostgreSQL, never in JavaScript over a full
 * table read — a browse endpoint that returns everything and filters client-side
 * works at 40 listings and falls over at 10,000.
 */

export interface BusinessSummary {
  id: string
  name: string
  slug: string
  description: string
  categoryName: string
  categorySlug: string
  cityName: string
  citySlug: string
  countryCode: string
  coverImage: string | null
  rating: number | null
  reviewCount: number
  priceLevel: number | null
  tier: 'BASIC' | 'ENHANCED' | 'FEATURED'
  verification: 'DEMO' | 'UNVERIFIED' | 'SELF_REPORTED' | 'VERIFIED'
  isDemo: boolean
  distanceKm: number | null
  openState: OpenState
  isFavourite: boolean
  activeDealCount: number
}

export interface BusinessDetail extends BusinessSummary {
  address: string
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
  instagram: string | null
  images: string[]
  countryName: string
  timezone: string
  openingHours: OpeningHours | null
  lastVerifiedAt: Date | null
  sourceType: string
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

/**
 * Columns needed for a card.
 *
 * `deals` is counted, not embedded — and `Deal.code` is never selected here.
 * A redemption code must not ride along in a list response and then be hidden
 * with CSS.
 */
const SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  rating: true,
  reviewCount: true,
  priceLevel: true,
  tier: true,
  verification: true,
  isDemo: true,
  latitude: true,
  longitude: true,
  openingHours: true,
  category: { select: { name: true, slug: true } },
  city: {
    select: { name: true, slug: true, timezone: true, country: { select: { code: true } } },
  },
} satisfies Prisma.BusinessSelect

type SummaryRow = Prisma.BusinessGetPayload<{ select: typeof SUMMARY_SELECT }>

const publishedWhere = { status: 'PUBLISHED', deletedAt: null } as const

/**
 * Deterministic ranking (§20).
 *
 * Applied in JavaScript over the current page only, on top of a stable SQL
 * ordering, so it never changes which rows a page contains — only their order
 * within it. Exact name matches surface first, then prefix, then contains;
 * featured listings break ties. No opaque scoring, no AI.
 */
export function rankBusinesses<T extends { name: string; tier: string; categoryName?: string }>(
  items: T[],
  query: string | undefined,
): T[] {
  if (!query) return items

  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return items

  const score = (item: T): number => {
    const name = item.name.toLowerCase()
    if (name === needle) return 0
    if (name.startsWith(needle)) return 1
    if (name.includes(needle)) return 2
    if (item.categoryName?.toLowerCase().includes(needle)) return 3
    return 4
  }

  const tierRank = (tier: string) => (tier === 'FEATURED' ? 0 : tier === 'ENHANCED' ? 1 : 2)

  return [...items].sort((a, b) => {
    const byScore = score(a) - score(b)
    if (byScore !== 0) return byScore

    const byTier = tierRank(a.tier) - tierRank(b.tier)
    if (byTier !== 0) return byTier

    return a.name.localeCompare(b.name)
  })
}

function buildWhere(filter: BusinessFilter, favouriteIds: string[] | null): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = { ...publishedWhere }

  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: 'insensitive' } },
      { description: { contains: filter.q, mode: 'insensitive' } },
      { category: { name: { contains: filter.q, mode: 'insensitive' } } },
    ]
  }

  if (filter.category) where.category = { slug: filter.category }

  // City and country both constrain the same relation, so they are composed once
  // rather than spread over an already-typed filter.
  const cityFilter: Prisma.CityWhereInput = {}
  if (filter.city) cityFilter.slug = filter.city
  if (filter.country) cityFilter.country = { code: filter.country }
  if (Object.keys(cityFilter).length > 0) where.city = cityFilter

  // An empty favourites list must yield nothing, not everything.
  if (favouriteIds !== null) where.id = { in: favouriteIds }

  return where
}

function toSummary(
  row: SummaryRow,
  options: { origin: Coordinates | null; favouriteIds: Set<string>; dealCounts: Map<string, number>; now: Date },
): BusinessSummary {
  const hours = parseOpeningHours(row.openingHours)

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    cityName: row.city.name,
    citySlug: row.city.slug,
    countryCode: row.city.country.code,
    coverImage: row.coverImage,
    rating: row.rating,
    reviewCount: row.reviewCount,
    priceLevel: row.priceLevel,
    tier: row.tier,
    verification: row.verification,
    isDemo: row.isDemo,
    distanceKm:
      options.origin && row.latitude !== null && row.longitude !== null
        ? calculateDistanceKm(options.origin, { latitude: row.latitude, longitude: row.longitude })
        : null,
    openState: getBusinessOpenState(hours, row.city.timezone, options.now),
    isFavourite: options.favouriteIds.has(row.id),
    activeDealCount: options.dealCounts.get(row.id) ?? 0,
  }
}

/**
 * Paged business browse.
 *
 * Four queries regardless of page size — count, page, favourites, deal counts —
 * so there is no N+1 across hours, categories, deals or favourites.
 */
export async function browseBusinesses(
  actor: Actor,
  filter: BusinessFilter,
  now: Date = new Date(),
): Promise<PagedResult<BusinessSummary>> {
  const favouriteIds = filter.favourites ? await listFavouriteBusinessIds(actor) : null
  const where = buildWhere(filter, favouriteIds)

  const skip = (filter.page - 1) * filter.pageSize

  const [total, rows] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      // Stable SQL ordering: featured first, then alphabetical. `id` breaks ties
      // so pagination can never repeat or skip a row.
      orderBy: [{ tier: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip,
      take: filter.pageSize,
      select: SUMMARY_SELECT,
    }),
  ])

  const ids = rows.map((row) => row.id)

  const [favourites, dealCounts, origin] = await Promise.all([
    favouriteSet(actor, ids),
    activeDealCounts(ids, now),
    memberOrigin(actor),
  ])

  const items = rows.map((row) =>
    toSummary(row, { origin, favouriteIds: favourites, dealCounts, now }),
  )

  return {
    items: rankBusinesses(items, filter.q),
    page: filter.page,
    pageSize: filter.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    hasPrevious: filter.page > 1,
    hasNext: skip + rows.length < total,
  }
}

/** Full detail for one listing. Slug-addressed, so URLs stay readable. */
export async function getBusinessBySlug(
  actor: Actor,
  slug: string,
  now: Date = new Date(),
): Promise<BusinessDetail> {
  const row = await prisma.business.findFirst({
    where: { slug, ...publishedWhere },
    select: {
      ...SUMMARY_SELECT,
      address: true,
      postalCode: true,
      phone: true,
      email: true,
      website: true,
      instagram: true,
      images: true,
      lastVerifiedAt: true,
      sourceType: true,
      city: {
        select: {
          name: true,
          slug: true,
          timezone: true,
          country: { select: { code: true, name: true } },
        },
      },
    },
  })

  if (!row) throw new NotFoundError('Business')

  const [favourites, dealCounts, origin] = await Promise.all([
    favouriteSet(actor, [row.id]),
    activeDealCounts([row.id], now),
    memberOrigin(actor),
  ])

  const summary = toSummary(
    { ...row, city: { ...row.city, country: { code: row.city.country.code } } },
    { origin, favouriteIds: favourites, dealCounts, now },
  )

  await track(actor.userId, ANALYTICS_EVENTS.BUSINESS_OPENED, {
    isDemo: row.isDemo,
    hasDeals: (dealCounts.get(row.id) ?? 0) > 0,
  })

  return {
    ...summary,
    address: row.address,
    postalCode: row.postalCode,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    images: row.images,
    countryName: row.city.country.name,
    timezone: row.city.timezone,
    openingHours: parseOpeningHours(row.openingHours),
    lastVerifiedAt: row.lastVerifiedAt,
    sourceType: row.sourceType,
  }
}

/** Record a search. The query text is deliberately never sent to analytics. */
export async function recordSearch(actor: Actor, filter: BusinessFilter, resultCount: number) {
  await track(actor.userId, ANALYTICS_EVENTS.BUSINESS_SEARCHED, {
    hasQuery: Boolean(filter.q),
    hasCategory: Boolean(filter.category),
    hasCity: Boolean(filter.city),
    resultCount,
  })
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function favouriteSet(actor: Actor, businessIds: string[]): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set()

  const rows = await prisma.favoriteBusiness.findMany({
    where: { userId: actor.userId, businessId: { in: businessIds } },
    select: { businessId: true },
  })

  return new Set(rows.map((row) => row.businessId))
}

async function listFavouriteBusinessIds(actor: Actor): Promise<string[]> {
  const rows = await prisma.favoriteBusiness.findMany({
    where: { userId: actor.userId },
    select: { businessId: true },
  })
  return rows.map((row) => row.businessId)
}

/** Active deal counts for a page of businesses, in one grouped query. */
async function activeDealCounts(businessIds: string[], now: Date): Promise<Map<string, number>> {
  if (businessIds.length === 0) return new Map()

  const rows = await prisma.deal.groupBy({
    by: ['businessId'],
    where: {
      businessId: { in: businessIds },
      status: 'ACTIVE',
      deletedAt: null,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    _count: { _all: true },
  })

  return new Map(rows.map((row) => [row.businessId, row._count._all]))
}

/**
 * The member's own coordinates, from their chosen city.
 *
 * City-level only — Phase 3 never asks for device location, so distance is
 * "from your city", which is honest and needs no permission prompt.
 */
async function memberOrigin(actor: Actor): Promise<Coordinates | null> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    select: { latitude: true, longitude: true },
  })

  if (!preference?.latitude || !preference.longitude) return null
  return { latitude: preference.latitude, longitude: preference.longitude }
}

/** Categories that actually have published listings, for the filter chips. */
export async function listCategories() {
  return prisma.businessCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      icon: true,
      type: true,
      _count: { select: { businesses: { where: publishedWhere } } },
    },
  })
}

/** Cities with published listings, for the city selector. */
export async function listCitiesWithListings() {
  const cities = await prisma.city.findMany({
    where: { isActive: true, businesses: { some: publishedWhere } },
    orderBy: [{ country: { name: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      country: { select: { code: true, name: true } },
      _count: { select: { businesses: { where: publishedWhere } } },
    },
  })

  return cities
}
