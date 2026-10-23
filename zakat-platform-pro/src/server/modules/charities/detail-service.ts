import 'server-only'

import type { CharityClaimType, CharitySourceType, ClaimStatus, ClaimValue, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { CharityNotFoundError } from '@/server/modules/charities/errors'
import {
  calculateTransparencyScore,
  type ScoredClaim,
  type TransparencyScoreResult,
} from '@/server/modules/charities/transparency/score'
import {
  assessFreshness,
  type Freshness,
} from '@/server/modules/charities/transparency/freshness'
import { factorFor } from '@/server/modules/charities/transparency/factors'
import {
  deriveZakatStatus,
  type ZakatStatusResult,
} from '@/server/modules/charities/transparency/zakat-status'

/**
 * Charity detail (§12).
 *
 * The score shown here is **recomputed from the current claims on every read**,
 * never taken from the cached column. That column exists only so the directory
 * can sort in SQL; if the two ever disagree, the recomputed one is right and
 * `recalculateTransparency()` has not run yet.
 *
 * Every claim is returned with its own source, date and freshness, so the page
 * can explain each statement instead of showing a bare checkmark.
 */

export interface ClaimView {
  type: CharityClaimType
  label: string
  description: string | null

  value: ClaimValue
  status: ClaimStatus
  valueText: string | null
  note: string | null

  verifiedAt: Date | null

  source: {
    id: string
    title: string
    url: string
    sourceType: CharitySourceType
    publisher: string | null
    publishedAt: Date | null
    retrievedAt: Date | null
    validUntil: Date | null
  } | null

  freshness: Freshness
  freshnessReason: string
}

export interface CharityDetail {
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
  verifiedAt: Date | null
  isDemo: boolean

  causes: Array<{ slug: string; name: string }>

  claims: ClaimView[]
  /** Sources not (or not yet) attached to any claim, listed for completeness. */
  unattachedSources: Array<{
    id: string
    title: string
    url: string
    sourceType: CharitySourceType
    retrievedAt: Date | null
  }>

  transparency: TransparencyScoreResult
  zakat: ZakatStatusResult

  isFavorite: boolean
  updatedAt: Date
}

const DETAIL_INCLUDE = {
  causes: { select: { cause: { select: { slug: true, name: true } } } },
  sources: { orderBy: { createdAt: 'asc' } },
  claims: {
    // Only current claims: superseded rows stay in the table as an evidence
    // trail but must not appear as live statements (§25).
    where: { supersededAt: null },
    include: { source: true },
    orderBy: { type: 'asc' },
  },
} satisfies Prisma.CharityInclude

type DetailRow = Prisma.CharityGetPayload<{ include: typeof DETAIL_INCLUDE }>

export async function getCharityDetail(
  slug: string,
  actor: Actor | null = null,
): Promise<CharityDetail> {
  const row = await prisma.charity.findFirst({
    where: { slug, active: true },
    include: DETAIL_INCLUDE,
  })

  if (!row) throw new CharityNotFoundError()

  const isFavorite = actor
    ? Boolean(
        await prisma.favoriteCharity.findUnique({
          where: { userId_charityId: { userId: actor.userId, charityId: row.id } },
          select: { id: true },
        }),
      )
    : false

  return toDetail(row, isFavorite)
}

function toDetail(row: DetailRow, isFavorite: boolean): CharityDetail {
  const now = new Date()

  const scoredClaims: ScoredClaim[] = row.claims.map((claim) => ({
    type: claim.type,
    value: claim.value,
    status: claim.status,
    source: claim.source
      ? {
          sourceType: claim.source.sourceType,
          publishedAt: claim.source.publishedAt,
          retrievedAt: claim.source.retrievedAt,
          validUntil: claim.source.validUntil,
        }
      : null,
  }))

  const claims: ClaimView[] = row.claims.map((claim) => {
    const factor = factorFor(claim.type)

    // Claims outside the scored factor set (a country claim, say) still get a
    // freshness reading so the UI can show how current the evidence is.
    const freshnessMonths = factor?.freshnessMonths ?? 24

    const freshness = claim.source
      ? assessFreshness(
          {
            publishedAt: claim.source.publishedAt,
            retrievedAt: claim.source.retrievedAt,
            validUntil: claim.source.validUntil,
            freshnessMonths,
          },
          now,
        )
      : { state: 'UNKNOWN' as const, reason: 'Er is geen bron voor deze claim.' }

    return {
      type: claim.type,
      label: factor?.label ?? CLAIM_LABELS[claim.type],
      description: factor?.description ?? null,
      value: claim.value,
      status: claim.status,
      valueText: claim.valueText,
      note: claim.note,
      verifiedAt: claim.verifiedAt,
      source: claim.source
        ? {
            id: claim.source.id,
            title: claim.source.title,
            url: claim.source.sourceUrl,
            sourceType: claim.source.sourceType,
            publisher: claim.source.publisher,
            publishedAt: claim.source.publishedAt,
            retrievedAt: claim.source.retrievedAt,
            validUntil: claim.source.validUntil,
          }
        : null,
      freshness: freshness.state,
      freshnessReason: freshness.reason,
    }
  })

  const attachedSourceIds = new Set(row.claims.map((c) => c.sourceId).filter(Boolean))

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
    verifiedAt: row.verifiedAt,
    isDemo: row.isDemo,
    causes: row.causes.map((c) => c.cause),
    claims,
    unattachedSources: row.sources
      .filter((source) => !attachedSourceIds.has(source.id))
      .map((source) => ({
        id: source.id,
        title: source.title,
        url: source.sourceUrl,
        sourceType: source.sourceType,
        retrievedAt: source.retrievedAt,
      })),
    transparency: calculateTransparencyScore({ claims: scoredClaims, now }),
    zakat: deriveZakatStatus(scoredClaims),
    isFavorite,
    updatedAt: row.updatedAt,
  }
}

export const CLAIM_LABELS: Record<CharityClaimType, string> = {
  REGISTERED_ENTITY: 'Geregistreerde organisatie',
  CONTACT_DETAILS_PUBLISHED: 'Contactgegevens gepubliceerd',
  GOVERNANCE_DISCLOSED: 'Bestuur bekendgemaakt',
  ANNUAL_REPORT_PUBLISHED: 'Jaarverslag gepubliceerd',
  FINANCIAL_STATEMENTS_PUBLISHED: 'Financiële cijfers gepubliceerd',
  AUDITOR_DISCLOSED: 'Accountant bekendgemaakt',
  ADMIN_COST_DISCLOSED: 'Beheerskosten gepubliceerd',
  IMPACT_REPORT_PUBLISHED: 'Resultatenrapportage',
  ACCEPTS_ZAKAT: 'Accepteert Zakat',
  ZAKAT_POLICY_PUBLISHED: 'Zakat-beleid gepubliceerd',
  ZAKAT_ALLOCATION_DESCRIBED: 'Zakat-besteding beschreven',
  ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED: 'Zakat-geschiktheid onafhankelijk bevestigd',
  OPERATES_IN_COUNTRY: 'Actief in land',
}
