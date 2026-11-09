import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import {
  browseBusinesses,
  listCategories,
  listCitiesWithListings,
  type BusinessSummary,
} from '@/server/modules/discovery/business.service'
import { browseDeals, type DealSummary } from '@/server/modules/discovery/deal.service'
import {
  getFavouriteCounts,
  listFavouriteBusinesses,
  listFavouriteDeals,
  type FavouriteCounts,
} from '@/server/modules/discovery/favourite.service'

/**
 * Explore home.
 *
 * One composition service behind `/app/explore`, mirroring `getMyDay()`. The page
 * never touches a repository; every independent read below runs concurrently.
 */

export interface ExploreCategory {
  slug: string
  name: string
  icon: string
  type: string
  count: number
}

export interface ExploreCity {
  id: string
  slug: string
  name: string
  countryCode: string
  countryName: string
  count: number
}

export interface ExploreData {
  /** The city being browsed — the member's own unless overridden by a filter. */
  activeCitySlug: string | null
  activeCityName: string | null
  memberCitySlug: string | null

  categories: ExploreCategory[]
  cities: ExploreCity[]

  nearby: BusinessSummary[]
  deals: DealSummary[]

  favouriteBusinesses: Awaited<ReturnType<typeof listFavouriteBusinesses>>
  favouriteDeals: Awaited<ReturnType<typeof listFavouriteDeals>>
  favouriteCounts: FavouriteCounts

  /** True when every listing in view is demonstration data. */
  allDemo: boolean
  totalListings: number
}

export async function getExplore(
  actor: Actor,
  options: { citySlug?: string } = {},
  now: Date = new Date(),
): Promise<ExploreData> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    select: { city: { select: { slug: true, name: true } } },
  })

  const memberCitySlug = preference?.city?.slug ?? null
  const activeCitySlug = options.citySlug ?? memberCitySlug ?? undefined

  const [categories, cities, nearby, deals, favouriteBusinesses, favouriteDeals, favouriteCounts] =
    await Promise.all([
      listCategories(),
      listCitiesWithListings(),
      browseBusinesses(
        actor,
        {
          city: activeCitySlug,
          page: 1,
          pageSize: 6,
          q: undefined,
          category: undefined,
          country: undefined,
          favourites: undefined,
        },
        now,
      ),
      browseDeals(
        actor,
        {
          city: activeCitySlug,
          page: 1,
          pageSize: 6,
          includeExpired: false,
          q: undefined,
          category: undefined,
          favourites: undefined,
        },
        now,
      ),
      listFavouriteBusinesses(actor, 6),
      listFavouriteDeals(actor, 6),
      getFavouriteCounts(actor),
    ])

  const activeCity = cities.find((city) => city.slug === activeCitySlug) ?? null

  await track(actor.userId, ANALYTICS_EVENTS.EXPLORE_OPENED, {
    hasCity: Boolean(activeCitySlug),
    favouriteCount: favouriteCounts.total,
  })

  return {
    activeCitySlug: activeCitySlug ?? null,
    activeCityName: activeCity?.name ?? preference?.city?.name ?? null,
    memberCitySlug,

    categories: categories
      .filter((category) => category._count.businesses > 0)
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        type: category.type,
        count: category._count.businesses,
      })),

    cities: cities.map((city) => ({
      id: city.id,
      slug: city.slug,
      name: city.name,
      countryCode: city.country.code,
      countryName: city.country.name,
      count: city._count.businesses,
    })),

    nearby: nearby.items,
    deals: deals.items,

    favouriteBusinesses,
    favouriteDeals,
    favouriteCounts,

    // Honesty signal for the page banner: while everything is seed data we say so
    // once, at the top, rather than relying on per-card badges alone.
    allDemo:
      nearby.items.length > 0 && nearby.items.every((business) => business.isDemo),
    totalListings: nearby.total,
  }
}
