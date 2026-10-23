import 'server-only'

import type { CauseCategory, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import {
  buildCharityOrderBy,
  buildCharityWhere,
} from '@/server/modules/charities/query'
import { deriveZakatStatus, type ZakatStatus } from '@/server/modules/charities/transparency/zakat-status'
import type { ScoredClaim } from '@/server/modules/charities/transparency/score'
import type { CharityFilterPayload } from '@/modules/charities/schemas'

/**
 * The charity directory (§1, §16, §17).
 *
 * Filtering, sorting and pagination all happen in the database through the
 * shared query builder. The Zakat status shown on a card is derived from the
 * charity's current claims, so a listing can never display a stronger label than
 * the evidence supports.
 */

export interface CharityCard {
  id: string
  slug: string
  name: string
  description: string | null

  country: string
  operatingCountries: string[]
  organizationType: string
  scope: string

  website: string
  donationUrl: string | null

  verified: boolean
  isDemo: boolean

  transparencyScore: number | null
  transparencyCoverage: number | null
  transparencyScoreVersion: string | null

  zakatStatus: ZakatStatus
  zakatLabel: string

  causes: Array<{ slug: string; name: string; category: CauseCategory }>
  sourceCount: number
  claimCount: number

  isFavorite: boolean
}

export interface CharityPage {
  charities: CharityCard[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  country: true,
  operatingCountries: true,
  organizationType: true,
  scope: true,
  website: true,
  donationUrl: true,
  verified: true,
  isDemo: true,
  transparencyScore: true,
  transparencyCoverage: true,
  transparencyScoreVersion: true,
  causes: { select: { cause: { select: { slug: true, name: true, category: true } } } },
  _count: { select: { sources: true } },
  claims: {
    where: { supersededAt: null },
    select: {
      type: true,
      value: true,
      status: true,
      source: {
        select: {
          sourceType: true,
          publishedAt: true,
          retrievedAt: true,
          validUntil: true,
        },
      },
    },
  },
} satisfies Prisma.CharitySelect

type CardRow = Prisma.CharityGetPayload<{ select: typeof CARD_SELECT }>

function toCard(row: CardRow, favoriteIds: ReadonlySet<string>): CharityCard {
  const claims = row.claims as ScoredClaim[]
  const zakat = deriveZakatStatus(claims)

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    country: row.country,
    operatingCountries: row.operatingCountries,
    organizationType: row.organizationType,
    scope: row.scope,
    website: row.website,
    donationUrl: row.donationUrl,
    verified: row.verified,
    isDemo: row.isDemo,
    transparencyScore: row.transparencyScore,
    transparencyCoverage: row.transparencyCoverage,
    transparencyScoreVersion: row.transparencyScoreVersion,
    zakatStatus: zakat.status,
    zakatLabel: zakat.label,
    causes: row.causes.map((c) => c.cause),
    sourceCount: row._count.sources,
    claimCount: claims.length,
    isFavorite: favoriteIds.has(row.id),
  }
}

/**
 * List charities.
 *
 * `actor` is optional: the directory is public, and an anonymous visitor simply
 * gets no favourite markers.
 */
export async function listCharities(
  filter: CharityFilterPayload,
  actor: Actor | null = null,
): Promise<CharityPage> {
  const favoriteIds = actor ? await favoriteIdsFor(actor) : []
  const favoriteSet = new Set(favoriteIds)

  // "Only favourites" with no favourites must return nothing, not everything.
  if (filter.favoritesOnly && favoriteIds.length === 0) {
    return { charities: [], total: 0, page: filter.page, perPage: filter.perPage, pageCount: 0 }
  }

  const where = buildCharityWhere(filter, { favoriteCharityIds: favoriteIds })

  const [total, rows] = await Promise.all([
    prisma.charity.count({ where }),
    prisma.charity.findMany({
      where,
      select: CARD_SELECT,
      orderBy: buildCharityOrderBy(filter.sort),
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
    }),
  ])

  return {
    charities: rows.map((row) => toCard(row, favoriteSet)),
    total,
    page: filter.page,
    perPage: filter.perPage,
    pageCount: Math.max(1, Math.ceil(total / filter.perPage)),
  }
}

async function favoriteIdsFor(actor: Actor): Promise<string[]> {
  const rows = await prisma.favoriteCharity.findMany({
    where: { userId: actor.userId },
    select: { charityId: true },
  })
  return rows.map((r) => r.charityId)
}

/** Countries and causes actually present in the directory, for the filter UI. */
export async function getDirectoryFacets(): Promise<{
  countries: string[]
  causes: Array<{ slug: string; name: string }>
}> {
  const [charities, causes] = await Promise.all([
    prisma.charity.findMany({
      where: { active: true, isDemo: false },
      select: { country: true, operatingCountries: true },
    }),
    prisma.cause.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const countries = new Set<string>()
  for (const charity of charities) {
    countries.add(charity.country)
    for (const code of charity.operatingCountries) countries.add(code)
  }

  return { countries: [...countries].sort(), causes }
}
