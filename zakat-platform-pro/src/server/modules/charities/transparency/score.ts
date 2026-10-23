import type { CharityClaimType, CharitySourceType, ClaimStatus, ClaimValue } from '@/generated/prisma/client'

import { tierOf } from '@/config/charity-sources'
import {
  MINIMUM_MEANINGFUL_COVERAGE,
  TOTAL_FACTOR_WEIGHT,
  TRANSPARENCY_FACTORS,
  TRANSPARENCY_SCORE_VERSION,
  type TransparencyFactor,
} from '@/server/modules/charities/transparency/factors'
import {
  FRESHNESS_WEIGHTS,
  assessFreshness,
  type Freshness,
} from '@/server/modules/charities/transparency/freshness'

/**
 * The transparency scoring engine (§6, §9, §22, §24).
 *
 * Pure and deterministic: claims and a reference date go in, a fully itemised
 * result comes out. The same input always produces the same components, which is
 * what lets a stored score stay explainable years later.
 *
 * ── How a factor earns points ────────────────────────────────────────────────
 *   weight × statusWeight × sourceTierWeight × freshnessWeight
 *
 * ── How UNKNOWN is handled ───────────────────────────────────────────────────
 * An unknown factor is **excluded from the denominator**, not scored as zero: a
 * charity that has not been researched is not thereby a bad charity (§9). That
 * alone would let one verified factor produce a score of 100, so the result also
 * reports `coverage` — how much of the factor set is actually known — and flags
 * anything below `MINIMUM_MEANINGFUL_COVERAGE`. The score and the coverage are
 * meant to be read together, and the UI shows both.
 *
 * An explicit NO *is* counted in the denominator: someone checked, and the
 * information is genuinely not published.
 */

export interface ScoredClaim {
  type: CharityClaimType
  value: ClaimValue
  status: ClaimStatus
  source?: {
    sourceType: CharitySourceType
    publishedAt?: Date | null
    retrievedAt?: Date | null
    validUntil?: Date | null
  } | null
}

export interface ScoreComponent {
  claimType: CharityClaimType
  label: string
  description: string

  weight: number
  /** Points actually earned, rounded to two decimals for display stability. */
  earned: number

  value: ClaimValue
  status: ClaimStatus
  freshness: Freshness

  /** Whether this factor counted towards the denominator. */
  assessed: boolean
  /** Plain-language explanation of this line, shown verbatim in the UI. */
  reason: string
  sourceType: CharitySourceType | null
}

export interface TransparencyScoreResult {
  /** 0–100 over the assessable factors, or null when nothing is known. */
  score: number | null
  version: string
  calculatedAt: Date

  /** 0–100: share of the factor set that is known either way. */
  coverage: number
  hasSufficientCoverage: boolean

  components: ScoreComponent[]
  missingFactors: Array<{ claimType: CharityClaimType; label: string }>
  warnings: string[]

  earnedPoints: number
  assessablePoints: number
  totalPoints: number
}

/** How much a factor's weight survives at each evidence status. */
const STATUS_WEIGHTS: Record<ClaimStatus, number> = {
  VERIFIED: 1,
  // Self-reported is honest evidence that something is published, but it is the
  // charity describing itself — it cannot count the same as an outside check.
  SELF_REPORTED: 0.6,
  UNVERIFIED: 0.3,
  // A disputed claim earns nothing but stays visible, with a warning.
  DISPUTED: 0,
}

export interface ScoreInput {
  claims: readonly ScoredClaim[]
  now?: Date
}

export function calculateTransparencyScore(input: ScoreInput): TransparencyScoreResult {
  const now = input.now ?? new Date()

  // Last claim of a type wins; callers pass current claims only, but being
  // explicit here keeps the function total.
  const byType = new Map<CharityClaimType, ScoredClaim>()
  for (const claim of input.claims) byType.set(claim.type, claim)

  const components: ScoreComponent[] = []
  const missingFactors: TransparencyScoreResult['missingFactors'] = []
  const warnings: string[] = []

  let earnedPoints = 0
  let assessablePoints = 0

  for (const factor of TRANSPARENCY_FACTORS) {
    const claim = byType.get(factor.claimType)

    if (!claim || claim.value === 'UNKNOWN') {
      missingFactors.push({ claimType: factor.claimType, label: factor.label })
      components.push(unknownComponent(factor))
      continue
    }

    const component = scoreFactor(factor, claim, now)
    components.push(component)

    assessablePoints += factor.weight
    earnedPoints += component.earned

    if (claim.status === 'DISPUTED') {
      warnings.push(`De claim "${factor.label}" wordt betwist en telt niet mee.`)
    }
    if (component.freshness === 'EXPIRED' && claim.value === 'YES') {
      warnings.push(`De bron voor "${factor.label}" is verlopen.`)
    } else if (component.freshness === 'STALE' && claim.value === 'YES') {
      warnings.push(`De bron voor "${factor.label}" is verouderd.`)
    }
  }

  const coverage = Math.round((assessablePoints / TOTAL_FACTOR_WEIGHT) * 100)
  const hasSufficientCoverage = coverage >= MINIMUM_MEANINGFUL_COVERAGE

  if (assessablePoints === 0) {
    warnings.push('Er is nog geen enkele factor onderzocht voor deze organisatie.')
  } else if (!hasSufficientCoverage) {
    warnings.push(
      `Slechts ${coverage}% van de factoren is onderzocht. De score zegt daardoor weinig.`,
    )
  }

  return {
    score: assessablePoints === 0 ? null : Math.round((earnedPoints / assessablePoints) * 100),
    version: TRANSPARENCY_SCORE_VERSION,
    calculatedAt: now,

    coverage,
    hasSufficientCoverage,

    components,
    missingFactors,
    warnings,

    earnedPoints: round2(earnedPoints),
    assessablePoints,
    totalPoints: TOTAL_FACTOR_WEIGHT,
  }
}

function scoreFactor(
  factor: TransparencyFactor,
  claim: ScoredClaim,
  now: Date,
): ScoreComponent {
  const freshnessResult = claim.source
    ? assessFreshness(
        {
          publishedAt: claim.source.publishedAt,
          retrievedAt: claim.source.retrievedAt,
          validUntil: claim.source.validUntil,
          freshnessMonths: factor.freshnessMonths,
        },
        now,
      )
    : { state: 'UNKNOWN' as const, ageMonths: null, measuredFrom: null, reason: 'Geen bron.' }

  const base = {
    claimType: factor.claimType,
    label: factor.label,
    description: factor.description,
    weight: factor.weight,
    value: claim.value,
    status: claim.status,
    freshness: freshnessResult.state,
    assessed: true,
    sourceType: claim.source?.sourceType ?? null,
  }

  if (claim.value === 'NO') {
    return {
      ...base,
      earned: 0,
      // Counted, because somebody checked and the answer was genuinely no.
      reason: 'Deze informatie is niet gepubliceerd.',
    }
  }

  const statusWeight = STATUS_WEIGHTS[claim.status]
  const tierWeight = claim.source ? tierOf(claim.source.sourceType).weight : 0.4
  const freshnessWeight = FRESHNESS_WEIGHTS[freshnessResult.state]

  const earned = round2(factor.weight * statusWeight * tierWeight * freshnessWeight)

  return { ...base, earned, reason: explain(claim, freshnessResult.reason) }
}

function unknownComponent(factor: TransparencyFactor): ScoreComponent {
  return {
    claimType: factor.claimType,
    label: factor.label,
    description: factor.description,
    weight: factor.weight,
    earned: 0,
    value: 'UNKNOWN',
    status: 'UNVERIFIED',
    freshness: 'UNKNOWN',
    // Excluded from the denominator: not researched is not the same as absent.
    assessed: false,
    reason: 'Niet onderzocht. Dit telt niet mee in de score.',
    sourceType: null,
  }
}

function explain(claim: ScoredClaim, freshnessReason: string): string {
  if (claim.status === 'DISPUTED') return 'Deze claim wordt betwist en telt niet mee.'
  if (!claim.source) return 'Opgegeven zonder bron, telt daarom beperkt mee.'

  const tier = tierOf(claim.source.sourceType)

  const statusText =
    claim.status === 'VERIFIED'
      ? 'Gecontroleerd tegen de bron.'
      : claim.status === 'SELF_REPORTED'
        ? 'Door de organisatie zelf gepubliceerd.'
        : 'Nog niet gecontroleerd.'

  return `${statusText} ${tier.label}. ${freshnessReason}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
