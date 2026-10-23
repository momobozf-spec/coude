import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 12
export const MAX_PAGE_SIZE = 48

/**
 * Browse filters.
 *
 * Everything lives in the query string, so a refresh, a deep link and the back
 * button all behave. `.catch()` on each field means a hand-edited or stale URL
 * degrades to the default rather than throwing a 500 at the member.
 */
export const businessFilterSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  city: z.string().trim().max(60).optional().catch(undefined),
  country: z.string().trim().length(2).toUpperCase().optional().catch(undefined),
  favourites: z.coerce.boolean().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE),
})

export type BusinessFilter = z.infer<typeof businessFilterSchema>

export const dealFilterSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  city: z.string().trim().max(60).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  favourites: z.coerce.boolean().optional().catch(undefined),
  /** Expired deals are hidden by default — see §25. */
  includeExpired: z.coerce.boolean().default(false).catch(false),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE),
})

export type DealFilter = z.infer<typeof dealFilterSchema>

/** Parse `searchParams` from a page into a validated filter. */
export function parseBusinessFilter(params: Record<string, string | string[] | undefined>) {
  return businessFilterSchema.parse(flatten(params))
}

export function parseDealFilter(params: Record<string, string | string[] | undefined>) {
  return dealFilterSchema.parse(flatten(params))
}

function flatten(params: Record<string, string | string[] | undefined>) {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(params)) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

/** Rebuild a query string from a filter, dropping defaults so URLs stay short. */
export function toSearchParams(filter: Partial<BusinessFilter & DealFilter>): string {
  const params = new URLSearchParams()

  if (filter.q) params.set('q', filter.q)
  if (filter.category) params.set('category', filter.category)
  if (filter.city) params.set('city', filter.city)
  if (filter.country) params.set('country', filter.country)
  if (filter.favourites) params.set('favourites', '1')
  if (filter.includeExpired) params.set('includeExpired', '1')
  if (filter.page && filter.page > 1) params.set('page', String(filter.page))

  const query = params.toString()
  return query.length > 0 ? `?${query}` : ''
}
