import {
  MetalPriceUnavailableError,
  type Metal,
  type MetalPrice,
  type MetalPriceProvider,
} from '@/server/integrations/metal-prices/types'
import type { ExchangeRateProvider } from '@/server/integrations/exchange-rates/types'
import { FixtureExchangeRateProvider } from '@/server/integrations/exchange-rates/fixture'
import { SCALE, divRound, fromScaled, pow10, toScaled } from '@/lib/decimal'

/**
 * Deterministic metal prices for development and tests.
 *
 * Prices are held in EUR per gram and converted through the exchange-rate
 * provider, so a fixture calculation in USD is internally consistent with a
 * fixture FX conversion. The numbers are plausible but are NOT market data —
 * `sourceType: FIXTURE` travels with them so the UI labels them as such rather
 * than implying a live religious or market source (§23).
 */

const EUR_PER_GRAM: Record<Metal, string> = {
  GOLD: '75.000000',
  SILVER: '0.850000',
}

/** Frozen so a fixture-backed calculation is byte-identical on every run. */
export const FIXTURE_METAL_OBSERVED_AT = new Date('2026-01-01T00:00:00.000Z')

export class FixtureMetalPriceProvider implements MetalPriceProvider {
  readonly name = 'fixture' as const

  constructor(private readonly fx: ExchangeRateProvider = new FixtureExchangeRateProvider()) {}

  getGoldPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('GOLD', currency)
  }

  getSilverPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('SILVER', currency)
  }

  private async priceOf(metal: Metal, currency: string): Promise<MetalPrice> {
    const target = currency.toUpperCase()
    const base = EUR_PER_GRAM[metal]

    let pricePerGram = base

    if (target !== 'EUR') {
      let rate
      try {
        rate = await this.fx.getRate('EUR', target)
      } catch {
        throw new MetalPriceUnavailableError(metal, target, 'geen wisselkoers')
      }

      // price_target = price_eur × rate, kept at metal-price scale throughout.
      const scaledPrice = toScaled(base, SCALE.METAL_PRICE)
      const scaledRate = toScaled(rate.rate, SCALE.FX_RATE)
      pricePerGram = fromScaled(
        divRound(scaledPrice * scaledRate, pow10(SCALE.FX_RATE)),
        SCALE.METAL_PRICE,
      )
    }

    return {
      metal,
      pricePerGram,
      currency: target,
      provider: this.name,
      sourceType: 'FIXTURE',
      observedAt: FIXTURE_METAL_OBSERVED_AT,
    }
  }
}
