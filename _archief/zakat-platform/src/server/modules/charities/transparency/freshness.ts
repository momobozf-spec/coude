/**
 * Evidence freshness (§10).
 *
 * A 2022 annual report is still evidence in 2026 — it is just older evidence,
 * and the difference has to be visible. Nothing is ever deleted for being old;
 * it is labelled, and the label feeds the score.
 *
 * Pure: the reference date is always passed in, so a freshness state is
 * reproducible rather than depending on when the page happened to render.
 */

export type Freshness = 'FRESH' | 'STALE' | 'EXPIRED' | 'UNKNOWN'

export interface FreshnessInput {
  /** When the platform last read the source. */
  retrievedAt?: Date | null
  /** The document's own date, where it has one. */
  publishedAt?: Date | null
  /** An explicit end of validity stated by the document. */
  validUntil?: Date | null
  /** How long this kind of evidence stays fresh. */
  freshnessMonths: number
}

export interface FreshnessResult {
  state: Freshness
  /** Age of the evidence in whole months, or null when there is no date at all. */
  ageMonths: number | null
  /** The date the age was measured from, so the UI can show it. */
  measuredFrom: Date | null
  reason: string
}

/** Beyond twice the freshness window, evidence is treated as expired. */
const EXPIRY_MULTIPLIER = 2

export function assessFreshness(input: FreshnessInput, now: Date = new Date()): FreshnessResult {
  // An explicit end date beats any inference: the document says so itself.
  if (input.validUntil && input.validUntil.getTime() <= now.getTime()) {
    return {
      state: 'EXPIRED',
      ageMonths: monthsBetween(input.validUntil, now),
      measuredFrom: input.validUntil,
      reason: `De geldigheid van deze bron is verlopen op ${formatDay(input.validUntil)}.`,
    }
  }

  // Prefer the document's own date; fall back to when we read it. A report from
  // 2022 that we fetched yesterday is old evidence, not fresh evidence.
  const measuredFrom = input.publishedAt ?? input.retrievedAt ?? null

  if (!measuredFrom) {
    return {
      state: 'UNKNOWN',
      ageMonths: null,
      measuredFrom: null,
      reason: 'Er is geen datum bekend voor deze bron.',
    }
  }

  const ageMonths = monthsBetween(measuredFrom, now)

  if (ageMonths < 0) {
    // A future date is a data-entry problem, not fresh evidence.
    return {
      state: 'UNKNOWN',
      ageMonths,
      measuredFrom,
      reason: 'De datum van deze bron ligt in de toekomst en is niet bruikbaar.',
    }
  }

  if (ageMonths <= input.freshnessMonths) {
    return {
      state: 'FRESH',
      ageMonths,
      measuredFrom,
      reason: `Bron is ${describeAge(ageMonths)} oud.`,
    }
  }

  if (ageMonths <= input.freshnessMonths * EXPIRY_MULTIPLIER) {
    return {
      state: 'STALE',
      ageMonths,
      measuredFrom,
      reason: `Bron is ${describeAge(ageMonths)} oud en daarmee verouderd.`,
    }
  }

  return {
    state: 'EXPIRED',
    ageMonths,
    measuredFrom,
    reason: `Bron is ${describeAge(ageMonths)} oud en wordt als verlopen behandeld.`,
  }
}

/** Whole months between two dates, floored. */
export function monthsBetween(from: Date, to: Date): number {
  const years = to.getUTCFullYear() - from.getUTCFullYear()
  const months = to.getUTCMonth() - from.getUTCMonth()
  const days = to.getUTCDate() - from.getUTCDate()

  return years * 12 + months - (days < 0 ? 1 : 0)
}

function describeAge(months: number): string {
  if (months < 1) return 'minder dan een maand'
  if (months === 1) return 'één maand'
  if (months < 12) return `${months} maanden`

  const years = Math.floor(months / 12)
  const rest = months % 12

  if (rest === 0) return years === 1 ? 'één jaar' : `${years} jaar`
  return `${years} jaar en ${rest} ${rest === 1 ? 'maand' : 'maanden'}`
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  FRESH: 'Actueel',
  STALE: 'Verouderd',
  EXPIRED: 'Verlopen',
  UNKNOWN: 'Datum onbekend',
}

/** How much of a factor's weight survives at each freshness state. */
export const FRESHNESS_WEIGHTS: Record<Freshness, number> = {
  FRESH: 1,
  STALE: 0.6,
  // Expired evidence still shows the information once existed, but earns almost
  // nothing — it should not prop up a score years later.
  EXPIRED: 0.2,
  UNKNOWN: 0.6,
}
