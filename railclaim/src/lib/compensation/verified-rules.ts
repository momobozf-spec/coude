import type { CompensationRuleRow } from './rules'

/**
 * REFERENCE DATA — the verified NMBS compensation rules.
 *
 * This is not demo data and not a fixture: it is the seed for the
 * `compensation_rules` table, and every value here was read off an official
 * NMBS/SNCB page on the date recorded in `verified_at`.
 * The evidence trail is in docs/nmbs-regels.md.
 *
 * Changing a number here without re-verifying the source and updating both
 * `verified_at` and docs/nmbs-regels.md is a defect, not a config tweak.
 */

const VERIFIED_AT = '2026-08-29T00:00:00.000Z'

const COMPENSATION_URL =
  'https://www.belgiantrain.be/nl/support/customer-service/compensation'
const CALCULATION_URL =
  'https://www.belgiantrain.be/nl/support/customer-service/compensation/calculte-your-compensation'

export const VERIFIED_COMPENSATION_RULES: readonly CompensationRuleRow[] = [
  {
    rule_key: 'SINGLE_DELAY',
    source_url: COMPENSATION_URL,
    verified_at: VERIFIED_AT,
    parameters: {
      // "Vanaf vertraging van minstens 60 minuten: vergoed aan 100% van de
      //  waarde van je traject."
      threshold_minutes: 60,
      percentage: 100,
      // "Vanaf de datum van je treinreis heb je 3 maanden om compensatie aan
      //  te vragen."
      submission_deadline_months: 3,
    },
  },
  {
    rule_key: 'FREQUENT_DELAYS',
    source_url: COMPENSATION_URL,
    verified_at: VERIFIED_AT,
    parameters: {
      // "Bij minstens 10 vertragingen van minimum 30 minuten over een
      //  tijdspanne van 6 maand ... binnen 6 tot 9 maanden na de eerste
      //  vertraging indienen."
      min_delay_minutes: 30,
      min_occurrences: 10,
      period_months: 6,
      percentage: 50,
      submission_window_opens_months: 6,
      submission_window_closes_months: 9,
      // "Indien je op hetzelfde traject herhaaldelijke vertragingen oploopt"
      same_route_required: true,
      // Exclusion: outbound and return both delayed with less than 2 hours
      // between arrival of the outbound and departure of the return.
      return_trip_min_gap_hours: 2,
      // "Als je NIET reisde met een abonnement" is an exclusion.
      requires_subscription: true,
    },
  },
  {
    rule_key: 'JOURNEY_DIVISORS',
    source_url: CALCULATION_URL,
    verified_at: VERIFIED_AT,
    parameters: {
      // "Aantal trajecten per type vervoersbewijs"
      SINGLE_TICKET: 1,
      RETURN_TICKET: 2,
      SUBSCRIPTION_1M: 40,
      SUBSCRIPTION_3M: 120,
      SUBSCRIPTION_12M: 480,
    },
  },
  {
    rule_key: 'ROUNDING',
    source_url: CALCULATION_URL,
    verified_at: VERIFIED_AT,
    parameters: {
      // "Eurocenten worden steeds afgerond naar het volgend tiental,
      //  bv. 9,35 wordt 9,40."
      mode: 'CEIL_TO_TEN_CENTS',
      // Derived from the published example: 1400 / 480 is shown as 2,91.
      journey_price_mode: 'FLOOR_TO_CENT',
    },
  },
] as const
