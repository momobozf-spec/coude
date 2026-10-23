import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { BusinessCard } from '@/modules/discovery/business-card'
import {
  ActiveFilters,
  CategoryChips,
  CitySelect,
  FavouritesToggle,
  SearchField,
} from '@/modules/discovery/discovery-filters'
import { DemoDataNotice, NoResults } from '@/modules/discovery/discovery-empty'
import { Pagination } from '@/modules/discovery/pagination'
import { requireActor } from '@/server/auth/actor'
import {
  browseBusinesses,
  listCategories,
  listCitiesWithListings,
  recordSearch,
} from '@/server/modules/discovery/business.service'
import { parseBusinessFilter } from '@/server/modules/discovery/discovery.schema'

export const metadata: Metadata = {
  title: 'Businesses',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requireActor()
  const params = await searchParams

  // Every filter comes from the URL, so refresh and deep links behave.
  const filter = parseBusinessFilter(params)

  const [result, categories, cities] = await Promise.all([
    browseBusinesses(actor, filter),
    listCategories(),
    listCitiesWithListings(),
  ])

  await recordSearch(actor, filter, result.total)

  const categoryOptions = categories
    .filter((category) => category._count.businesses > 0)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      count: category._count.businesses,
    }))

  const cityOptions = cities.map((city) => ({
    slug: city.slug,
    name: city.name,
    countryName: city.country.name,
    count: city._count.businesses,
  }))

  const hasFilters = Boolean(
    filter.q || filter.category || filter.city || filter.country || filter.favourites,
  )
  const allDemo = result.items.length > 0 && result.items.every((item) => item.isDemo)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="Browse halal food, retail and services across our early-access cities."
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <SearchField />
          </div>
          <CitySelect cities={cityOptions} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FavouritesToggle />
          <div className="min-w-0 flex-1">
            <CategoryChips categories={categoryOptions} />
          </div>
        </div>

        <ActiveFilters
          categories={categoryOptions}
          cities={cityOptions.map((city) => ({ slug: city.slug, name: city.name }))}
        />
      </div>

      {allDemo ? <DemoDataNotice /> : null}

      {result.items.length === 0 ? (
        <NoResults
          categoryName={categoryOptions.find((c) => c.slug === filter.category)?.name}
          cityName={cityOptions.find((c) => c.slug === filter.city)?.name}
          query={filter.q}
          clearHref="/app/explore/businesses"
          hasFilters={hasFilters}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>

          <Pagination
            basePath="/app/explore/businesses"
            searchParams={params}
            page={result.page}
            totalPages={result.totalPages}
            hasPrevious={result.hasPrevious}
            hasNext={result.hasNext}
            total={result.total}
          />
        </>
      )}
    </div>
  )
}
