import { describe, expect, it } from 'vitest'

import { FixtureExchangeRateProvider } from '@/server/integrations/exchange-rates/fixture'
import { ManualExchangeRateProvider } from '@/server/integrations/exchange-rates/manual'
import { ExchangeRateUnavailableError } from '@/server/integrations/exchange-rates/types'
import { FixtureMetalPriceProvider } from '@/server/integrations/metal-prices/fixture'
import { ManualMetalPriceProvider } from '@/server/integrations/metal-prices/manual'
import { MetalPriceUnavailableError } from '@/server/integrations/metal-prices/types'

/**
 * Provider abstractions (§6, §7, §30).
 *
 * The fixture providers must be deterministic — a calculation that changes
 * between two runs of the test suite would also change between two views of the
 * same draft.
 */

describe('fixture exchange rates', () => {
  const fx = new FixtureExchangeRateProvider()

  it('returns exactly 1 for a currency against itself', async () => {
    const rate = await fx.getRate('EUR', 'EUR')
    // Crossing through EUR could produce 0.99999999; the identity case must not.
    expect(rate.rate).toBe('1')
  })

  it('is deterministic across calls', async () => {
    const a = await fx.getRate('USD', 'EUR')
    const b = await fx.getRate('USD', 'EUR')
    expect(a.rate).toBe(b.rate)
    expect(a.observedAt).toEqual(b.observedAt)
  })

  it('converts a foreign currency to EUR', async () => {
    const rate = await fx.getRate('USD', 'EUR')
    expect(rate.rate).toBe('0.92000000')
    expect(rate.provider).toBe('fixture')
  })

  it('crosses two non-EUR currencies consistently', async () => {
    const usdToEur = await fx.getRate('USD', 'EUR')
    const eurToUsd = await fx.getRate('EUR', 'USD')

    // Round-tripping must land back within one unit at the last decimal.
    const product = Number(usdToEur.rate) * Number(eurToUsd.rate)
    expect(product).toBeCloseTo(1, 6)
  })

  it('carries its provider name so the UI can label it', async () => {
    const rate = await fx.getRate('MAD', 'EUR')
    expect(rate.provider).toBe('fixture')
  })

  it('rejects an unsupported currency instead of guessing', async () => {
    await expect(fx.getRate('XYZ', 'EUR')).rejects.toThrow(ExchangeRateUnavailableError)
  })
})

describe('manual exchange rates', () => {
  it('uses the rate the user supplied', async () => {
    const fx = new ManualExchangeRateProvider({ 'USD/EUR': '0.95' })
    const rate = await fx.getRate('USD', 'EUR')

    expect(rate.rate).toBe('0.95')
    expect(rate.provider).toBe('manual')
  })

  it('still returns 1 for the identity pair', async () => {
    const fx = new ManualExchangeRateProvider({})
    expect((await fx.getRate('EUR', 'EUR')).rate).toBe('1')
  })

  it('fails rather than falling back to market data', async () => {
    const fx = new ManualExchangeRateProvider({ 'USD/EUR': '0.95' })
    await expect(fx.getRate('GBP', 'EUR')).rejects.toThrow(ExchangeRateUnavailableError)
  })
})

describe('fixture metal prices', () => {
  const metals = new FixtureMetalPriceProvider()

  it('returns a EUR price per gram', async () => {
    const gold = await metals.getGoldPrice('EUR')
    expect(gold.pricePerGram).toBe('75.000000')
    expect(gold.currency).toBe('EUR')
    expect(gold.metal).toBe('GOLD')
  })

  it('labels itself as a fixture, never as a live source', async () => {
    const gold = await metals.getGoldPrice('EUR')
    expect(gold.sourceType).toBe('FIXTURE')
    expect(gold.provider).toBe('fixture')
  })

  it('is deterministic', async () => {
    const a = await metals.getSilverPrice('EUR')
    const b = await metals.getSilverPrice('EUR')
    expect(a.pricePerGram).toBe(b.pricePerGram)
    expect(a.observedAt).toEqual(b.observedAt)
  })

  it('converts into another currency through the FX provider', async () => {
    const gold = await metals.getGoldPrice('USD')
    // €75 / 0.92 EUR-per-USD → about $81.52 per gram.
    expect(gold.currency).toBe('USD')
    expect(Number(gold.pricePerGram)).toBeGreaterThan(80)
    expect(Number(gold.pricePerGram)).toBeLessThan(83)
  })

  it('reports silver far below gold', async () => {
    const gold = await metals.getGoldPrice('EUR')
    const silver = await metals.getSilverPrice('EUR')
    expect(Number(silver.pricePerGram)).toBeLessThan(Number(gold.pricePerGram))
  })

  it('fails for a currency it cannot reach', async () => {
    await expect(metals.getGoldPrice('XYZ')).rejects.toThrow(MetalPriceUnavailableError)
  })
})

describe('manual metal prices', () => {
  it('uses the price the user entered', async () => {
    const metals = new ManualMetalPriceProvider({ goldPerGram: '82.50', currency: 'EUR' })
    const gold = await metals.getGoldPrice('EUR')

    expect(gold.pricePerGram).toBe('82.50')
    expect(gold.sourceType).toBe('MANUAL')
  })

  it('fails for a metal the user did not price', async () => {
    const metals = new ManualMetalPriceProvider({ goldPerGram: '82.50', currency: 'EUR' })
    await expect(metals.getSilverPrice('EUR')).rejects.toThrow(MetalPriceUnavailableError)
  })

  it('refuses to convert a hand-entered price into another currency', async () => {
    const metals = new ManualMetalPriceProvider({ goldPerGram: '82.50', currency: 'EUR' })
    // Converting would attribute a number to the user that they never typed.
    await expect(metals.getGoldPrice('USD')).rejects.toThrow(MetalPriceUnavailableError)
  })
})
