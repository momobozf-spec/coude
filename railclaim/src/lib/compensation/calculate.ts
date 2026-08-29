import type {
  CompensationRuleSet,
  TicketType,
} from './rules'

/**
 * Deterministic compensation arithmetic, exactly as published by NMBS
 * (docs/nmbs-regels.md §4). No LLM, no heuristics, no hidden fudge factors.
 *
 * All money is handled in integer CENTS. Floating-point euros silently produce
 * 14.549999999999999 and would round the wrong way at a threshold.
 */

/**
 * "Eurocenten worden steeds afgerond naar het volgend tiental, bv. 9,35 wordt 9,40."
 * Ceil to the next multiple of 10 cents.
 */
export function roundUpToTenCents(cents: number): number {
  if (!Number.isFinite(cents)) throw new Error('roundUpToTenCents: non-finite input')
  return Math.ceil(cents / 10) * 10
}

/**
 * Price of a single journey = ticket price / number of journeys.
 *
 * Floored to whole cents, per the NMBS worked example: an annual subscription of
 * EUR 1400 over 480 journeys is published as EUR 2,91 (1400/480 = 2.9166…),
 * not 2,92. Rounding to nearest would overstate every downstream total.
 */
export function journeyPriceCents(
  ticketPriceCents: number,
  ticketType: TicketType,
  rules: CompensationRuleSet,
): number {
  if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
    throw new Error('journeyPriceCents: ticket price must be a positive integer in cents')
  }
  const divisor = rules.journeyDivisors[ticketType]
  if (!divisor || divisor <= 0) {
    throw new Error(`journeyPriceCents: no divisor configured for ticket type ${ticketType}`)
  }
  return Math.floor(ticketPriceCents / divisor)
}

export type ClaimType = 'SINGLE_DELAY' | 'FREQUENT_DELAYS'

export interface CompensationInput {
  claimType: ClaimType
  ticketPriceCents: number
  ticketType: TicketType
  /** Number of qualifying delayed journeys included in this claim. */
  delayedJourneyCount: number
}

export interface CompensationBreakdown {
  claimType: ClaimType
  journeyPriceCents: number
  delayedJourneyCount: number
  totalJourneyPriceCents: number
  percentage: number
  /** Before the rounding step — useful for showing the calculation. */
  rawCompensationCents: number
  /** What we present to the user. */
  compensationCents: number
  /**
   * NMBS publishes a ceil-to-ten-cents rule but its own first worked example
   * (EUR 4,25) does not apply it. We apply the stated rule and label every
   * amount as indicative; the binding amount is the one NMBS pays.
   */
  isIndicative: true
}

/**
 * Compute the expected compensation.
 *
 * The percentage comes from the verified rule set, selected by claim type —
 * 100% for a single long delay, 50% under the repeated-delays scheme.
 */
export function calculateCompensation(
  input: CompensationInput,
  rules: CompensationRuleSet,
): CompensationBreakdown {
  if (!Number.isInteger(input.delayedJourneyCount) || input.delayedJourneyCount <= 0) {
    throw new Error('calculateCompensation: delayedJourneyCount must be a positive integer')
  }

  const percentage =
    input.claimType === 'SINGLE_DELAY'
      ? rules.singleDelay.percentage
      : rules.frequentDelays.percentage

  const perJourney = journeyPriceCents(input.ticketPriceCents, input.ticketType, rules)
  const totalJourneyPriceCents = perJourney * input.delayedJourneyCount
  const rawCompensationCents = Math.round((totalJourneyPriceCents * percentage) / 100)

  return {
    claimType: input.claimType,
    journeyPriceCents: perJourney,
    delayedJourneyCount: input.delayedJourneyCount,
    totalJourneyPriceCents,
    percentage,
    rawCompensationCents,
    compensationCents: roundUpToTenCents(rawCompensationCents),
    isIndicative: true,
  }
}

// --------------------------------------------------------------------------
// Eligibility — the only place that decides whether a delay qualifies
// --------------------------------------------------------------------------

export interface SingleDelayEligibility {
  qualifies: boolean
  thresholdMinutes: number
  delayMinutes: number
  reason: 'BELOW_THRESHOLD' | 'QUALIFIES'
}

/**
 * Does one trip qualify on its own? Strictly `>=` the verified threshold.
 * A 59-minute delay is not a claim, however tempting.
 */
export function evaluateSingleDelay(
  delayMinutes: number,
  rules: CompensationRuleSet,
): SingleDelayEligibility {
  const thresholdMinutes = rules.singleDelay.threshold_minutes
  const qualifies = delayMinutes >= thresholdMinutes
  return {
    qualifies,
    thresholdMinutes,
    delayMinutes,
    reason: qualifies ? 'QUALIFIES' : 'BELOW_THRESHOLD',
  }
}

/** Does a delay count toward the repeated-delays tally? */
export function countsTowardFrequentDelays(
  delayMinutes: number,
  rules: CompensationRuleSet,
): boolean {
  return delayMinutes >= rules.frequentDelays.min_delay_minutes
}

// --------------------------------------------------------------------------
// Deadlines
// --------------------------------------------------------------------------

/**
 * Add whole months to a CALENDAR DATE.
 *
 * Deliberately uses UTC component arithmetic. A deadline is a calendar date
 * ("three months from the journey date"), not an instant, and doing this with
 * local-time getters shifts the result by a day whenever the start and end
 * dates straddle a DST boundary — e.g. 15 March + 3 months came out as 14 June
 * on a Brussels machine. Service dates are anchored at UTC midnight for exactly
 * this reason (see toServiceDate in lib/irail/client.ts).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const targetDay = result.getUTCDate()
  result.setUTCMonth(result.getUTCMonth() + months)
  // Clamp e.g. 31 Jan + 3 months to 30 April rather than rolling into May.
  if (result.getUTCDate() < targetDay) result.setUTCDate(0)
  return result
}

/** Single delay: 3 months from the journey date (docs/nmbs-regels.md §2). */
export function singleDelayDeadline(
  serviceDate: Date,
  rules: CompensationRuleSet,
): Date {
  return addMonths(serviceDate, rules.singleDelay.submission_deadline_months)
}

export interface FrequentDelaysWindow {
  opensAt: Date
  closesAt: Date
}

/**
 * Repeated delays: the window OPENS 6 months after the first delay and closes
 * at 9 months. Filing before it opens is not possible — this is the detail that
 * makes the whole scheme impractical to track by hand.
 */
export function frequentDelaysWindow(
  firstDelayDate: Date,
  rules: CompensationRuleSet,
): FrequentDelaysWindow {
  return {
    opensAt: addMonths(firstDelayDate, rules.frequentDelays.submission_window_opens_months),
    closesAt: addMonths(firstDelayDate, rules.frequentDelays.submission_window_closes_months),
  }
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

export function formatEuro(cents: number, locale: 'nl-BE' | 'fr-BE' = 'nl-BE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  )
}

export function euroToCents(euro: number): number {
  return Math.round(euro * 100)
}
