import { describe, expect, it } from 'vitest'

import { evaluateAsset } from '@/server/modules/zakat/rules/asset-rule-evaluator'
import {
  addMonths,
  evaluateLiability,
} from '@/server/modules/zakat/rules/liability-rule-evaluator'
import { CALCULATION_DATE, makeAsset, makeLiability, makeRuleSet } from './helpers/zakat'

/**
 * Rule evaluation (§12).
 *
 * The point of these tests is that no decision comes from the asset type itself:
 * flipping a ruleset row flips the outcome, with no code change.
 */

describe('asset rules', () => {
  it('includes an asset the ruleset marks zakatable', () => {
    const decision = evaluateAsset(makeAsset({ type: 'SAVINGS' }), makeRuleSet())
    expect(decision.included).toBe(true)
    expect(decision.percentage).toBe('100')
  })

  it('excludes an asset when the ruleset says so — no code change needed', () => {
    const ruleSet = makeRuleSet()
    ruleSet.assetRules.set('CRYPTO', {
      assetType: 'CRYPTO',
      zakatable: false,
      defaultZakatablePercentage: '0',
      rationale: 'Deze regelset rekent crypto niet mee.',
    })

    const decision = evaluateAsset(makeAsset({ type: 'CRYPTO' }), ruleSet)
    expect(decision.included).toBe(false)
    expect(decision.reason).toBe('Deze regelset rekent crypto niet mee.')
  })

  it('applies a partial percentage from the ruleset', () => {
    const ruleSet = makeRuleSet()
    ruleSet.assetRules.set('INVESTMENTS', {
      assetType: 'INVESTMENTS',
      zakatable: true,
      defaultZakatablePercentage: '30',
      rationale: 'Alleen het Zakat-plichtige deel van de onderliggende activa.',
    })

    const decision = evaluateAsset(makeAsset({ type: 'INVESTMENTS' }), ruleSet)
    expect(decision.included).toBe(true)
    expect(decision.percentage).toBe('30')
  })

  it('lets a user override beat the ruleset default', () => {
    const decision = evaluateAsset(
      makeAsset({ type: 'INVESTMENTS', zakatablePercentage: '25' }),
      makeRuleSet(),
    )

    expect(decision.percentage).toBe('25')
    expect(decision.ruleBasis).toBe('Eigen aanpassing')
  })

  it('treats a user override of 0% as excluded', () => {
    const decision = evaluateAsset(
      makeAsset({ type: 'RECEIVABLES', zakatablePercentage: '0' }),
      makeRuleSet(),
    )

    expect(decision.included).toBe(false)
    expect(decision.reason).toContain('0%')
  })

  it('excludes a category the ruleset has no opinion on', () => {
    const ruleSet = makeRuleSet()
    ruleSet.assetRules.delete('OTHER')

    const decision = evaluateAsset(makeAsset({ type: 'OTHER' }), ruleSet)
    // Counting it would attribute a ruling to the ruleset that it never made.
    expect(decision.included).toBe(false)
    expect(decision.reason).toContain('geen regel')
  })

  it('always reports which rule decided', () => {
    const decision = evaluateAsset(makeAsset({ type: 'GOLD' }), makeRuleSet())
    expect(decision.ruleBasis).toContain('2026.1-default')
    expect(decision.reason.length).toBeGreaterThan(0)
  })
})

describe('liability rules', () => {
  const ruleSet = makeRuleSet()

  it('deducts a category the ruleset allows', () => {
    const decision = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT' }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )
    expect(decision.deductible).toBe(true)
  })

  it('does not deduct merely because the liability exists', () => {
    const decision = evaluateLiability(
      makeLiability({ type: 'OTHER' }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )
    expect(decision.deductible).toBe(false)
    expect(decision.reason).toBe('Niet automatisch aftrekbaar.')
  })

  it('honours the profile switch that turns deduction off', () => {
    const decision = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT' }),
      ruleSet,
      CALCULATION_DATE,
      false,
    )
    expect(decision.deductible).toBe(false)
    expect(decision.ruleBasis).toBe('Profielinstelling')
  })

  it('honours a ruleset that deducts nothing at all', () => {
    const strict = makeRuleSet({ allowLiabilityDeduction: false })
    const decision = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT' }),
      strict,
      CALCULATION_DATE,
      true,
    )
    expect(decision.deductible).toBe(false)
  })

  it('excludes an obligation falling outside the twelve-month window', () => {
    const decision = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT', dueDate: new Date('2030-01-01T00:00:00Z') }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )

    // This is what stops a whole mortgage being deducted in a single year.
    expect(decision.deductible).toBe(false)
    expect(decision.reason).toContain('12 maanden')
  })

  it('includes an obligation falling inside the window', () => {
    const decision = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT', dueDate: new Date('2026-11-01T00:00:00Z') }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )
    expect(decision.deductible).toBe(true)
  })

  it('lets a user override force deduction on or off', () => {
    const forced = evaluateLiability(
      makeLiability({ type: 'OTHER', deductibleForZakat: true }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )
    expect(forced.deductible).toBe(true)
    expect(forced.ruleBasis).toBe('Eigen aanpassing')

    const excluded = evaluateLiability(
      makeLiability({ type: 'SHORT_TERM_DEBT', deductibleForZakat: false }),
      ruleSet,
      CALCULATION_DATE,
      true,
    )
    expect(excluded.deductible).toBe(false)
  })
})

describe('addMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    // 31 January + 1 month must be 28 February, not 3 March.
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 0).toISOString().slice(0, 10)).toBe(
      '2026-01-31',
    )
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
      '2026-02-28',
    )
  })

  it('crosses a year boundary', () => {
    expect(addMonths(new Date('2026-08-07T00:00:00Z'), 12).toISOString().slice(0, 10)).toBe(
      '2027-08-07',
    )
  })
})
