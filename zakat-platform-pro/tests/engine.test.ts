import { describe, expect, it } from 'vitest'

import { calculateZakat } from '@/server/modules/zakat/engine'
import { computeNisab } from '@/server/modules/zakat/nisab'
import { ExchangeRateUnavailableAppError } from '@/server/modules/zakat/errors'
import { ENGINE_VERSION, type ZakatEngineInput } from '@/server/modules/zakat/types'
import {
  CALCULATION_DATE,
  makeAsset,
  makeFxTable,
  makeLiability,
  makeMetalPrice,
  makeRate,
  makeRuleSet,
} from './helpers/zakat'

/**
 * The calculation pipeline (§30).
 *
 * Everything is exercised through the public `calculateZakat` entry point with
 * explicit inputs, because that is the same surface the application service and
 * a replayed snapshot use.
 */

const ruleSet = makeRuleSet()

function input(overrides: Partial<ZakatEngineInput> = {}): ZakatEngineInput {
  return {
    calculationDate: CALCULATION_DATE,
    currency: 'EUR',
    methodology: 'DEFAULT',
    ruleSet,
    assets: [],
    liabilities: [],
    nisab: computeNisab({
      basis: 'SILVER',
      currency: 'EUR',
      ruleSet,
      metalPrice: makeMetalPrice({ pricePerGram: '0.850000' }),
    }),
    fx: makeFxTable([]),
    deductLiabilities: true,
    ...overrides,
  }
}

describe('nisab comparison', () => {
  // Silver nisab at fixture prices is €505.75.
  it('owes nothing below the nisab', () => {
    const result = calculateZakat(
      input({ assets: [makeAsset({ value: '100.00' })] }),
    )

    expect(result.aboveNisab).toBe(false)
    expect(result.zakatDueMinor).toBe(0)
    expect(result.netZakatableWealthMinor).toBe(10_000)
  })

  it('treats reaching the nisab exactly as reaching it', () => {
    const result = calculateZakat(
      input({ assets: [makeAsset({ value: '505.75' })] }),
    )

    // The threshold is the point at which Zakat becomes due, not one to exceed.
    expect(result.netZakatableWealthMinor).toBe(result.nisab.valueMinor)
    expect(result.aboveNisab).toBe(true)
    expect(result.zakatDueMinor).toBe(1264) // 2.5% of 505.75 = 12.64375 → 12.64
  })

  it('owes 2.5% above the nisab', () => {
    const result = calculateZakat(
      input({ assets: [makeAsset({ value: '55000.00' })] }),
    )

    expect(result.aboveNisab).toBe(true)
    expect(result.zakatDueMinor).toBe(137_500) // €1,375.00
  })

  it('one cent below the nisab still owes nothing', () => {
    const result = calculateZakat(
      input({ assets: [makeAsset({ value: '505.74' })] }),
    )
    expect(result.aboveNisab).toBe(false)
    expect(result.zakatDueMinor).toBe(0)
  })
})

describe('the worked example from the specification', () => {
  it('reproduces €58,500 gross → €55,000 net → €1,375 due', () => {
    const result = calculateZakat(
      input({
        assets: [
          makeAsset({ type: 'SAVINGS', name: 'Spaargeld', value: '35000.00' }),
          makeAsset({ type: 'INVESTMENTS', name: 'Beleggingen', value: '15000.00' }),
          makeAsset({ type: 'GOLD', name: 'Goud', value: '8500.00' }),
        ],
        liabilities: [makeLiability({ name: 'Korte termijn', amount: '3500.00' })],
      }),
    )

    expect(result.grossZakatableAssetsMinor).toBe(5_850_000)
    expect(result.deductibleLiabilitiesMinor).toBe(350_000)
    expect(result.netZakatableWealthMinor).toBe(5_500_000)
    expect(result.zakatDueMinor).toBe(137_500)
  })
})

describe('assets', () => {
  it('sums many categories exactly', () => {
    const result = calculateZakat(
      input({
        assets: [
          makeAsset({ type: 'CASH', value: '0.10' }),
          makeAsset({ type: 'SAVINGS', value: '0.20' }),
          makeAsset({ type: 'BANK_ACCOUNT', value: '1000.00' }),
        ],
      }),
    )

    // The 0.1 + 0.2 case, through the real pipeline: exactly 30 cents.
    expect(result.grossZakatableAssetsMinor).toBe(100_030)
  })

  it('applies a partial percentage to the converted amount', () => {
    const partial = makeRuleSet()
    partial.assetRules.set('INVESTMENTS', {
      assetType: 'INVESTMENTS',
      zakatable: true,
      defaultZakatablePercentage: '30',
      rationale: 'Deel van de onderliggende activa.',
    })

    const result = calculateZakat(
      input({
        ruleSet: partial,
        assets: [makeAsset({ type: 'INVESTMENTS', value: '10000.00' })],
      }),
    )

    expect(result.grossZakatableAssetsMinor).toBe(300_000)
    expect(result.items[0]?.zakatablePercentage).toBe('30')
  })

  it('contributes zero for an excluded asset but still explains it', () => {
    const excluding = makeRuleSet()
    excluding.assetRules.set('PROPERTY_INVESTMENT', {
      assetType: 'PROPERTY_INVESTMENT',
      zakatable: false,
      defaultZakatablePercentage: '0',
      rationale: 'Verhuurd vastgoed telt zelf niet mee.',
    })

    const result = calculateZakat(
      input({
        ruleSet: excluding,
        assets: [
          makeAsset({ type: 'SAVINGS', value: '1000.00' }),
          makeAsset({ type: 'PROPERTY_INVESTMENT', value: '250000.00' }),
        ],
      }),
    )

    expect(result.grossZakatableAssetsMinor).toBe(100_000)

    const excluded = result.items.find((i) => i.type === 'PROPERTY_INVESTMENT')
    expect(excluded?.included).toBe(false)
    expect(excluded?.amountMinor).toBe(0)
    // An excluded line must still be visible with its reason (§13).
    expect(excluded?.reason).toBe('Verhuurd vastgoed telt zelf niet mee.')
  })

  it('values gold entered by weight from the price feed', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ type: 'GOLD', name: 'Sieraden', weightGrams: '120', value: '0' })],
        goldPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
      }),
    )

    // 120 g × €75 = €9,000.00
    expect(result.grossZakatableAssetsMinor).toBe(900_000)
    expect(result.items[0]?.originalAmount).toBe('120 g')
  })

  it('values silver by weight independently of gold', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ type: 'SILVER', weightGrams: '1000', value: '0' })],
        goldPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
        silverPrice: makeMetalPrice({ pricePerGram: '0.850000' }),
      }),
    )

    expect(result.grossZakatableAssetsMinor).toBe(85_000)
  })

  it('falls back to the entered value when no price is available', () => {
    const result = calculateZakat(
      input({ assets: [makeAsset({ type: 'GOLD', weightGrams: '120', value: '8500.00' })] }),
    )

    expect(result.grossZakatableAssetsMinor).toBe(850_000)
  })
})

describe('multi-currency', () => {
  it('converts a foreign asset at the supplied rate', () => {
    const result = calculateZakat(
      input({
        assets: [
          makeAsset({ value: '1000.00', currency: 'EUR' }),
          makeAsset({ value: '1000.00', currency: 'USD' }),
        ],
        fx: makeFxTable([makeRate('USD', 'EUR', '0.92000000')]),
      }),
    )

    // €1,000 + ($1,000 × 0.92) = €1,920.00
    expect(result.grossZakatableAssetsMinor).toBe(192_000)
  })

  it('records every rate it used, for the snapshot', () => {
    const result = calculateZakat(
      input({
        assets: [
          makeAsset({ value: '100.00', currency: 'USD' }),
          makeAsset({ value: '200.00', currency: 'USD' }),
          makeAsset({ value: '300.00', currency: 'GBP' }),
        ],
        fx: makeFxTable([
          makeRate('USD', 'EUR', '0.92000000'),
          makeRate('GBP', 'EUR', '1.17000000'),
        ]),
      }),
    )

    // Two distinct pairs, not three uses.
    expect(result.ratesUsed).toHaveLength(2)
    expect(result.ratesUsed.map((r) => r.from).sort()).toEqual(['GBP', 'USD'])
  })

  it('does not record a rate when nothing needed converting', () => {
    const result = calculateZakat(input({ assets: [makeAsset({ value: '100.00' })] }))
    expect(result.ratesUsed).toHaveLength(0)
    expect(result.items[0]?.exchangeRate).toBeNull()
  })

  it('refuses to guess a missing rate', () => {
    expect(() =>
      calculateZakat(
        input({ assets: [makeAsset({ value: '100.00', currency: 'USD' })], fx: makeFxTable([]) }),
      ),
    ).toThrow(ExchangeRateUnavailableAppError)
  })

  it('converts liabilities too', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ value: '10000.00' })],
        liabilities: [makeLiability({ amount: '1000.00', currency: 'USD' })],
        fx: makeFxTable([makeRate('USD', 'EUR', '0.92000000')]),
      }),
    )

    expect(result.deductibleLiabilitiesMinor).toBe(92_000)
    expect(result.netZakatableWealthMinor).toBe(908_000)
  })
})

describe('liabilities', () => {
  it('deducts only what the rules allow', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ value: '10000.00' })],
        liabilities: [
          makeLiability({ type: 'SHORT_TERM_DEBT', amount: '1000.00' }),
          makeLiability({ type: 'OTHER', amount: '5000.00' }),
        ],
      }),
    )

    expect(result.deductibleLiabilitiesMinor).toBe(100_000)
    expect(result.netZakatableWealthMinor).toBe(900_000)
  })

  it('never produces a negative net wealth', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ value: '1000.00' })],
        liabilities: [makeLiability({ amount: '5000.00' })],
      }),
    )

    // Debts beyond your assets leave nothing to tithe, not a negative obligation.
    expect(result.netZakatableWealthMinor).toBe(0)
    expect(result.aboveNisab).toBe(false)
    expect(result.zakatDueMinor).toBe(0)
  })

  it('lists a non-deductible liability with its reason', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ value: '10000.00' })],
        liabilities: [makeLiability({ type: 'OTHER', name: 'Studieschuld', amount: '5000.00' })],
      }),
    )

    const line = result.items.find((i) => i.label === 'Studieschuld')
    expect(line?.included).toBe(false)
    expect(line?.amountMinor).toBe(0)
    expect(line?.reason).toBe('Niet automatisch aftrekbaar.')
  })
})

describe('explanation output', () => {
  it('emits one structured item per input, included or not', () => {
    const result = calculateZakat(
      input({
        assets: [makeAsset({ value: '100.00' }), makeAsset({ type: 'OTHER', value: '50.00' })],
        liabilities: [makeLiability({ amount: '10.00' })],
      }),
    )

    expect(result.items).toHaveLength(3)
    // No layer below the UI builds a sentence — every line is data (§13).
    for (const item of result.items) {
      expect(item.reason.length).toBeGreaterThan(0)
      expect(item.ruleBasis.length).toBeGreaterThan(0)
      expect(item.sourceEntityId).toBeTruthy()
    }
  })

  it('reports the ruleset and engine version that produced it', () => {
    const result = calculateZakat(input({ assets: [makeAsset({ value: '100.00' })] }))

    expect(result.rulesVersion).toBe('2026.1-default')
    expect(result.ruleSetId).toBe('ruleset-1')
    expect(result.engineVersion).toBe(ENGINE_VERSION)
    expect(result.zakatRate).toBe('0.025')
  })

  it('carries the nisab provenance into the result', () => {
    const result = calculateZakat(input({ assets: [makeAsset({ value: '100.00' })] }))

    expect(result.nisab.basis).toBe('SILVER')
    expect(result.nisab.metalWeightGrams).toBe('595')
    expect(result.nisab.priceProvider).toBe('fixture')
  })
})

describe('determinism', () => {
  it('produces an identical result for identical input', () => {
    const built = input({
      assets: [
        makeAsset({ value: '35000.00' }),
        makeAsset({ type: 'GOLD', weightGrams: '120', value: '0' }),
        makeAsset({ value: '1000.00', currency: 'USD' }),
      ],
      liabilities: [makeLiability({ amount: '3500.00' })],
      fx: makeFxTable([makeRate('USD', 'EUR', '0.92000000')]),
      goldPrice: makeMetalPrice({ pricePerGram: '75.000000' }),
    })

    expect(JSON.stringify(calculateZakat(built))).toBe(JSON.stringify(calculateZakat(built)))
  })

  it('changes only when an input changes — the price is an input, not ambient', () => {
    const assets = [makeAsset({ type: 'GOLD', weightGrams: '100', value: '0' })]

    const cheap = calculateZakat(
      input({ assets, goldPrice: makeMetalPrice({ pricePerGram: '75.000000' }) }),
    )
    const dear = calculateZakat(
      input({ assets, goldPrice: makeMetalPrice({ pricePerGram: '90.000000' }) }),
    )

    // This is precisely why a finalised snapshot stores its price rather than
    // re-fetching one: the same holding values differently at a different price.
    expect(cheap.grossZakatableAssetsMinor).toBe(750_000)
    expect(dear.grossZakatableAssetsMinor).toBe(900_000)
  })
})
