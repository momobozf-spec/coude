import 'server-only'

import type { CauseCategory, VerificationStatus } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'

/**
 * Read model for the charity directory.
 *
 * Note what is *not* here: no ranking, no "best charity". Charities come back in
 * a stable, explainable order and every transparency claim carries its source
 * count so the UI can say where the information came from (§23, §25).
 */

export interface CharityListItem {
  id: string
  slug: string
  name: string
  description: string | null
  country: string
  operatingCountries: string[]
  website: string
  donationUrl: string | null
  verified: boolean
  transparencyScore: number | null
  acceptsZakat: boolean
  verificationStatus: VerificationStatus | null
  causes: Array<{ slug: string; name: string; category: CauseCategory }>
  sourceCount: number
}

export interface CharityFilter {
  country?: string
  causeSlug?: string
  acceptsZakat?: boolean
  verifiedOnly?: boolean
  search?: string
}

export async function listCharities(filter: CharityFilter = {}): Promise<CharityListItem[]> {
  const charities = await prisma.charity.findMany({
    where: {
      active: true,
      ...(filter.verifiedOnly ? { verified: true } : {}),
      ...(filter.country ? { operatingCountries: { has: filter.country } } : {}),
      ...(filter.causeSlug ? { causes: { some: { cause: { slug: filter.causeSlug } } } } : {}),
      ...(filter.acceptsZakat ? { transparency: { acceptsZakat: true } } : {}),
      ...(filter.search
        ? { name: { contains: filter.search, mode: 'insensitive' as const } }
        : {}),
    },
    // Verified first, then by score, then alphabetically. Deterministic and
    // explainable — not a hidden relevance ranking.
    orderBy: [{ verified: 'desc' }, { transparencyScore: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      country: true,
      operatingCountries: true,
      website: true,
      donationUrl: true,
      verified: true,
      transparencyScore: true,
      transparency: { select: { acceptsZakat: true, verificationStatus: true } },
      causes: { select: { cause: { select: { slug: true, name: true, category: true } } } },
      _count: { select: { sources: true } },
    },
  })

  return charities.map((charity) => ({
    id: charity.id,
    slug: charity.slug,
    name: charity.name,
    description: charity.description,
    country: charity.country,
    operatingCountries: charity.operatingCountries,
    website: charity.website,
    donationUrl: charity.donationUrl,
    verified: charity.verified,
    transparencyScore: charity.transparencyScore,
    acceptsZakat: charity.transparency?.acceptsZakat ?? false,
    verificationStatus: charity.transparency?.verificationStatus ?? null,
    causes: charity.causes.map((c) => c.cause),
    sourceCount: charity._count.sources,
  }))
}
