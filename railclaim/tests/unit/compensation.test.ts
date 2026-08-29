import { describe, expect, it } from 'vitest'

import {
  calculateCompensation,
  countsTowardFrequentDelays,
  euroToCents,
  evaluateSingleDelay,
  frequentDelaysWindow,
  journeyPriceCents,
  roundUpToTenCents,
  singleDelayDeadline,
} from '@/lib/compensation/calculate'
import {
  buildRuleSet,
  isRuleSetStale,
  MissingCompensationRuleError,
  type CompensationRuleRow,
} from '@/lib/compensation/rules'
import { VERIFIED_COMPENSATION_RULES } from '@/lib/compensation/verified-rules'

const rules = buildRuleSet(VERIFIED_COMPENSATION_RULES as CompensationRuleRow[])

describe('rule set loading', () => {
  it('refuses to build without every verified rule present', () => {
    const incomplete = VERIFIED_COMPENSATION_RULES.filter(
      (r) => r.rule_key !== 'SINGLE_DELAY',
    ) as CompensationRuleRow[]
    expect(() => buildRuleSet(incomplete)).toThrow(MissingCompensationRuleError)
  })

  it('loads the thresholds from data, not from code', () => {
    expect(rules.singleDelay.threshold_minutes).toBe(60)
    expect(rules.singleDelay.percentage).toBe(100)
    expect(rules.frequentDelays.min_delay_minutes).toBe(30)
    expect(rules.frequentDelays.min_occurrences).toBe(10)
    expect(rules.frequentDelays.percentage).toBe(50)
  })

  it('carries a source url and verification date for every rule', () => {
    for (const row of VERIFIED_COMPENSATION_RULES) {
      expect(row.source_url).toMatch(/^https:\/\/www\.belgiantrain\.be\//)
      expect(new Date(row.verified_at).toString()).not.toBe('Invalid Date')
    }
  })

  it('flags a rule set older than six months as stale', () => {
    expect(isRuleSetStale(rules, new Date('2026-09-01'))).toBe(false)
    expect(isRuleSetStale(rules, new Date('2027-06-01'))).toBe(true)
  })
})

describe('rounding — "eurocenten worden steeds afgerond naar het volgend tiental"', () => {
  it('rounds 9,35 up to 9,40 (the example NMBS publishes)', () => {
    expect(roundUpToTenCents(935)).toBe(940)
  })

  it('rounds 14,55 up to 14,60 (NMBS worked example 3)', () => {
    expect(roundUpToTenCents(1455)).toBe(1460)
  })

  it('leaves an exact multiple of ten cents untouched', () => {
    expect(roundUpToTenCents(1160)).toBe(1160)
    expect(roundUpToTenCents(0)).toBe(0)
  })
})

describe('journey price — divisors published by NMBS', () => {
  it('single ticket is not divided', () => {
    expect(journeyPriceCents(euroToCents(11.6), 'SINGLE_TICKET', rules)).toBe(1160)
  })

  it('return ticket splits in two (senior ticket example)', () => {
    expect(journeyPriceCents(euroToCents(8.5), 'RETURN_TICKET', rules)).toBe(425)
  })

  it('annual subscription divides by 480 and FLOORS to whole cents', () => {
    // 1400 / 480 = 2.91666... NMBS publishes 2,91 — flooring, not rounding.
    expect(journeyPriceCents(euroToCents(1400), 'SUBSCRIPTION_12M', rules)).toBe(291)
  })

  it('rejects a non-positive ticket price', () => {
    expect(() => journeyPriceCents(0, 'SINGLE_TICKET', rules)).toThrow()
  })
})

describe('NMBS published worked examples reproduce exactly', () => {
  it('example 1: senior return ticket EUR 8,50, delay 2h -> EUR 4,25', () => {
    const result = calculateCompensation(
      {
        claimType: 'SINGLE_DELAY',
        ticketPriceCents: euroToCents(8.5),
        ticketType: 'RETURN_TICKET',
        delayedJourneyCount: 1,
      },
      rules,
    )
    expect(result.journeyPriceCents).toBe(425)
    expect(result.totalJourneyPriceCents).toBe(425)
    expect(result.percentage).toBe(100)
    expect(result.rawCompensationCents).toBe(425)
  })

  it('example 2: single ticket EUR 11,60, delay 60 min -> EUR 11,60', () => {
    const result = calculateCompensation(
      {
        claimType: 'SINGLE_DELAY',
        ticketPriceCents: euroToCents(11.6),
        ticketType: 'SINGLE_TICKET',
        delayedJourneyCount: 1,
      },
      rules,
    )
    expect(result.rawCompensationCents).toBe(1160)
    expect(result.compensationCents).toBe(1160)
  })

  it('example 3: annual sub EUR 1400, 10 delays of 30 min -> EUR 14,60', () => {
    const result = calculateCompensation(
      {
        claimType: 'FREQUENT_DELAYS',
        ticketPriceCents: euroToCents(1400),
        ticketType: 'SUBSCRIPTION_12M',
        delayedJourneyCount: 10,
      },
      rules,
    )
    expect(result.journeyPriceCents).toBe(291)
    expect(result.totalJourneyPriceCents).toBe(2910)
    expect(result.percentage).toBe(50)
    expect(result.rawCompensationCents).toBe(1455)
    // NMBS states this rounded result explicitly: "14,55 = afgerond 14,60"
    expect(result.compensationCents).toBe(1460)
  })

  it('always marks the amount as indicative', () => {
    const result = calculateCompensation(
      {
        claimType: 'SINGLE_DELAY',
        ticketPriceCents: euroToCents(11.6),
        ticketType: 'SINGLE_TICKET',
        delayedJourneyCount: 1,
      },
      rules,
    )
    expect(result.isIndicative).toBe(true)
  })
})

describe('eligibility uses >= the verified threshold and never rounds up to it', () => {
  it('59 minutes does not qualify for a single-delay claim', () => {
    const result = evaluateSingleDelay(59, rules)
    expect(result.qualifies).toBe(false)
    expect(result.reason).toBe('BELOW_THRESHOLD')
  })

  it('exactly 60 minutes qualifies', () => {
    expect(evaluateSingleDelay(60, rules).qualifies).toBe(true)
  })

  it('29 minutes does not count toward the frequent-delays tally, 30 does', () => {
    expect(countsTowardFrequentDelays(29, rules)).toBe(false)
    expect(countsTowardFrequentDelays(30, rules)).toBe(true)
  })
})

describe('deadlines', () => {
  it('single delay: three months from the journey date', () => {
    const deadline = singleDelayDeadline(new Date('2026-03-15T00:00:00Z'), rules)
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-06-15')
  })

  it('clamps a month-end date instead of rolling into the next month', () => {
    // 31 Jan + 3 months must not become 1 May.
    const deadline = singleDelayDeadline(new Date('2026-01-31T00:00:00Z'), rules)
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-04-30')
  })

  it('frequent delays: window opens at 6 months and closes at 9', () => {
    const window = frequentDelaysWindow(new Date('2026-01-10T00:00:00Z'), rules)
    expect(window.opensAt.toISOString().slice(0, 10)).toBe('2026-07-10')
    expect(window.closesAt.toISOString().slice(0, 10)).toBe('2026-10-10')
  })
})
