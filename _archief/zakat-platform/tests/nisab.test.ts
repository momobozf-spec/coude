import { describe, expect, it } from 'vitest'

import { computeNisab } from '@/server/modules/zakat/nisab'
import { InvalidNisabConfigurationError } from '@/server/modules/zakat/errors'
import { makeMetalPrice, makeRuleSet } from './helpers/zakat'

/**
 * The nisab engine (§30).
 *
 * Every case pins both the value and its provenance: a nisab without a recorded
 * source is a number the user cannot check.
 */

const ruleSet = makeRuleSet()

describe('gold basis', () => {
  it('values 85 grams at the supplied price', () => {
    const result = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
    })

    // 85 g × €75 = €6,375.00
    expect(result.valueMinor).toBe(637_500)
    expect(result.metalWeightGrams).toBe('85')
    expect(result.basis).toBe('GOLD')
  })

  it('records the provenance of the price', () => {
    const observedAt = new Date('2026-03-01T12:00:00.000Z')
    const result = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ provider: 'fixture', observedAt }),
    })

    expect(result.priceProvider).toBe('fixture')
    expect(result.priceSourceType).toBe('FIXTURE')
    expect(result.priceObservedAt).toEqual(observedAt)
    expect(result.manual).toBe(false)
  })

  it('takes the weight from the ruleset, not from code', () => {
    const custom = makeRuleSet({ goldNisabGrams: '87.48' })
    const result = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet: custom,
      metalPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
    })

    // 87.48 × 75 = 6561.00
    expect(result.valueMinor).toBe(656_100)
  })

  it('rounds the product exactly once', () => {
    const result = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet: makeRuleSet({ goldNisabGrams: '85.555' }),
      metalPrice: makeMetalPrice({ pricePerGram: '74.123456' }),
    })

    // 85.555 × 74.123456 = 6341.63227808 exactly → 634163 minor units.
    // Rounded once, from the full product — not from a pre-rounded price.
    expect(result.valueMinor).toBe(634_163)
  })
})

describe('silver basis', () => {
  it('values 595 grams at the supplied price', () => {
    const result = computeNisab({
      basis: 'SILVER',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ pricePerGram: '0.850000' }),
    })

    // 595 g × €0.85 = €505.75
    expect(result.valueMinor).toBe(50_575)
    expect(result.metalWeightGrams).toBe('595')
  })

  it('gives a lower threshold than gold at fixture prices', () => {
    const gold = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
    })
    const silver = computeNisab({
      basis: 'SILVER',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ pricePerGram: '0.850000' }),
    })

    expect(silver.valueMinor).toBeLessThan(gold.valueMinor)
  })
})

describe('manual price', () => {
  it('is flagged as manual so the UI cannot present it as a feed', () => {
    const result = computeNisab({
      basis: 'GOLD',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({
        pricePerGram: '80.000000',
        provider: 'manual',
        sourceType: 'MANUAL',
      }),
    })

    expect(result.manual).toBe(true)
    expect(result.priceSourceType).toBe('MANUAL')
    expect(result.valueMinor).toBe(680_000)
  })
})

describe('custom basis', () => {
  it('uses the value the user typed', () => {
    const result = computeNisab({
      basis: 'CUSTOM',
      currency: 'EUR',
      ruleSet,
      customValue: '7125.00',
    })

    expect(result.valueMinor).toBe(712_500)
    expect(result.basis).toBe('CUSTOM')
  })

  it('claims no provider or observation time', () => {
    const result = computeNisab({
      basis: 'CUSTOM',
      currency: 'EUR',
      ruleSet,
      customValue: '7125.00',
    })

    // Attributing a hand-typed figure to a market source is exactly what §23 forbids.
    expect(result.priceProvider).toBeNull()
    expect(result.priceObservedAt).toBeNull()
    expect(result.pricePerGram).toBeNull()
    expect(result.metalWeightGrams).toBeNull()
    expect(result.manual).toBe(true)
  })

  it('rejects a missing or non-positive value', () => {
    expect(() =>
      computeNisab({ basis: 'CUSTOM', currency: 'EUR', ruleSet, customValue: null }),
    ).toThrow(InvalidNisabConfigurationError)

    expect(() =>
      computeNisab({ basis: 'CUSTOM', currency: 'EUR', ruleSet, customValue: '0' }),
    ).toThrow(InvalidNisabConfigurationError)
  })
})

describe('configuration errors', () => {
  it('refuses a metal basis without a price', () => {
    expect(() => computeNisab({ basis: 'GOLD', currency: 'EUR', ruleSet })).toThrow(
      InvalidNisabConfigurationError,
    )
  })

  it('refuses a price quoted in a different currency', () => {
    expect(() =>
      computeNisab({
        basis: 'GOLD',
        currency: 'USD',
        ruleSet,
        metalPrice: makeMetalPrice({ currency: 'EUR' }),
      }),
    ).toThrow(InvalidNisabConfigurationError)
  })
})
