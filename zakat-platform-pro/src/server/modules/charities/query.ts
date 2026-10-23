import type { Prisma } from '@/generated/prisma/client'

import type { CharityFilterPayload } from '@/modules/charities/schemas'

/**
 * The single charity query builder (§1, §16).
 *
 * Every surface that lists charities — the public directory, the donation
 * picker, favourites, the dashboard — goes through this. Duplicating the filter
 * logic per page is how one of them ends up quietly showing archived or demo
 * records that the others hide.
 *
 * Filtering happens in the database, never by fetching everything and narrowing
 * in JavaScript, so the directory keeps working as the dataset grows.
 */

export interface CharityQueryContext {
  /** Restricts to these ids, for the "only my favourites" filter. */
  favoriteCharityIds?: readonly string[]
}

export function buildCharityWhere(
  filter: CharityFilterPayload,
  context: CharityQueryContext = {},
): Prisma.CharityWhereInput {
  const where: Prisma.CharityWhereInput = { active: true }

  if (filter.country) {
    // Matches both the country of registration and where the charity operates.
    where.OR = [
      { country: filter.country },
      { operatingCountries: { has: filter.country } },
    ]
  }

  if (filter.cause) {
    where.causes = { some: { cause: { slug: filter.cause } } }
  }

  if (filter.verifiedOnly) where.verified = true

  if (filter.organizationType) where.organizationType = filter.organizationType

  if (filter.scope) where.scope = filter.scope

  // Demo records are excluded unless explicitly asked for, so a fictional entry
  // can never turn up in a real search result by accident (§2, §18).
  if (!filter.includeDemo) where.isDemo = false

  if (filter.favoritesOnly) {
    where.id = { in: [...(context.favoriteCharityIds ?? [])] }
  }

  if (filter.search) {
    const search = filter.search.trim()
    if (search.length > 0) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }
  }

  // Zakat filtering runs off the claim, not off a denormalised boolean: the
  // claim is the thing that carries evidence (§3, §11).
  if (filter.acceptsZakat) {
    where.claims = {
      some: {
        type: 'ACCEPTS_ZAKAT',
        value: 'YES',
        supersededAt: null,
      },
    }
  }

  if (filter.zakatPolicyPublished) {
    where.claims = {
      some: {
        type: 'ZAKAT_POLICY_PUBLISHED',
        value: 'YES',
        supersededAt: null,
        // A policy claim without evidence is not a published policy.
        sourceId: { not: null },
      },
    }
  }

  return where
}

export type CharitySort = 'name' | 'recent' | 'transparency'

/**
 * Sort orders.
 *
 * `transparency` sorts by the transparency score and nothing else — the UI is
 * required to label it as such rather than as a ranking, because the score
 * measures verifiability and not quality (§7, §17).
 */
export function buildCharityOrderBy(
  sort: CharitySort = 'name',
): Prisma.CharityOrderByWithRelationInput[] {
  switch (sort) {
    case 'recent':
      return [{ updatedAt: 'desc' }, { name: 'asc' }]

    case 'transparency':
      // Nulls last: an unresearched charity should not lead the list.
      return [{ transparencyScore: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }]

    case 'name':
    default:
      return [{ name: 'asc' }]
  }
}
