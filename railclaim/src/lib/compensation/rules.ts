import { z } from 'zod'

/**
 * Shapes of the verified NMBS rules held in `compensation_rules`.
 *
 * NO THRESHOLD, PERCENTAGE OR DEADLINE IS HARDCODED IN APPLICATION CODE.
 * Every number below is loaded from the database, where it sits next to the
 * source URL it was verified against and the date it was checked
 * (see docs/nmbs-regels.md). These schemas only describe the shape.
 */

export const RULE_KEYS = [
  'SINGLE_DELAY',
  'FREQUENT_DELAYS',
  'JOURNEY_DIVISORS',
  'ROUNDING',
] as const
export type RuleKey = (typeof RULE_KEYS)[number]

/** Occasional long delay — docs/nmbs-regels.md §2 */
export const singleDelayParamsSchema = z.object({
  threshold_minutes: z.number().int().positive(),
  percentage: z.number().positive().max(100),
  submission_deadline_months: z.number().int().positive(),
})
export type SingleDelayParams = z.infer<typeof singleDelayParamsSchema>

/** Repeated delays for subscription holders — docs/nmbs-regels.md §3 */
export const frequentDelaysParamsSchema = z.object({
  min_delay_minutes: z.number().int().positive(),
  min_occurrences: z.number().int().positive(),
  period_months: z.number().int().positive(),
  percentage: z.number().positive().max(100),
  /** Window opens only AFTER this many months — you cannot file early. */
  submission_window_opens_months: z.number().int().nonnegative(),
  submission_window_closes_months: z.number().int().positive(),
  same_route_required: z.boolean(),
  /** Exclusion 6: outbound+return both delayed with less than this gap counts once. */
  return_trip_min_gap_hours: z.number().positive(),
  requires_subscription: z.boolean(),
})
export type FrequentDelaysParams = z.infer<typeof frequentDelaysParamsSchema>

/** Journeys per ticket type — docs/nmbs-regels.md §4 */
export const TICKET_TYPES = [
  'SINGLE_TICKET',
  'RETURN_TICKET',
  'SUBSCRIPTION_1M',
  'SUBSCRIPTION_3M',
  'SUBSCRIPTION_12M',
] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export const journeyDivisorsParamsSchema = z.object({
  SINGLE_TICKET: z.number().int().positive(),
  RETURN_TICKET: z.number().int().positive(),
  SUBSCRIPTION_1M: z.number().int().positive(),
  SUBSCRIPTION_3M: z.number().int().positive(),
  SUBSCRIPTION_12M: z.number().int().positive(),
})
export type JourneyDivisorsParams = z.infer<typeof journeyDivisorsParamsSchema>

export const roundingParamsSchema = z.object({
  mode: z.literal('CEIL_TO_TEN_CENTS'),
  /** Per-journey price is floored to whole cents before multiplying (NMBS example 3). */
  journey_price_mode: z.literal('FLOOR_TO_CENT'),
})
export type RoundingParams = z.infer<typeof roundingParamsSchema>

export interface CompensationRuleRow {
  rule_key: RuleKey
  parameters: unknown
  source_url: string
  verified_at: string
}

export interface CompensationRuleSet {
  singleDelay: SingleDelayParams
  frequentDelays: FrequentDelaysParams
  journeyDivisors: JourneyDivisorsParams
  rounding: RoundingParams
  /** Oldest verified_at across the set — drives the STALE warning. */
  oldestVerifiedAt: Date
  sources: Record<RuleKey, { source_url: string; verified_at: string }>
}

export class MissingCompensationRuleError extends Error {
  constructor(key: RuleKey) {
    super(
      `Compensation rule "${key}" is missing from the database. ` +
        `Claims cannot be evaluated without verified rules — refusing to guess.`,
    )
    this.name = 'MissingCompensationRuleError'
  }
}

/**
 * Validate raw rows into a usable rule set.
 * Throws if anything is missing: we would rather stop the pipeline than
 * evaluate a claim against an assumed threshold.
 */
export function buildRuleSet(rows: CompensationRuleRow[]): CompensationRuleSet {
  const byKey = new Map(rows.map((r) => [r.rule_key, r]))

  function need(key: RuleKey): CompensationRuleRow {
    const row = byKey.get(key)
    if (!row) throw new MissingCompensationRuleError(key)
    return row
  }

  const single = need('SINGLE_DELAY')
  const frequent = need('FREQUENT_DELAYS')
  const divisors = need('JOURNEY_DIVISORS')
  const rounding = need('ROUNDING')

  const sources = Object.fromEntries(
    ([single, frequent, divisors, rounding] as const).map((r) => [
      r.rule_key,
      { source_url: r.source_url, verified_at: r.verified_at },
    ]),
  ) as CompensationRuleSet['sources']

  const oldestVerifiedAt = new Date(
    Math.min(...rows.map((r) => new Date(r.verified_at).getTime())),
  )

  return {
    singleDelay: singleDelayParamsSchema.parse(single.parameters),
    frequentDelays: frequentDelaysParamsSchema.parse(frequent.parameters),
    journeyDivisors: journeyDivisorsParamsSchema.parse(divisors.parameters),
    rounding: roundingParamsSchema.parse(rounding.parameters),
    oldestVerifiedAt,
    sources,
  }
}

/** Admin dashboard: rules older than 6 months need re-verification. */
export const STALE_AFTER_MONTHS = 6

export function isRuleSetStale(ruleSet: CompensationRuleSet, now: Date = new Date()): boolean {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - STALE_AFTER_MONTHS)
  return ruleSet.oldestVerifiedAt < cutoff
}
