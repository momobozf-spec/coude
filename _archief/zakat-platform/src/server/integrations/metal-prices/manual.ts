import {
  MetalPriceUnavailableError,
  type Metal,
  type MetalPrice,
  type MetalPriceProvider,
} from '@/server/integrations/metal-prices/types'

/**
 * Prices entered by the user — someone who checked today's rate at their own
 * jeweller or bank and wants the calculation to use exactly that.
 *
 * A missing price is an error, never a fallback to fixture data: a manual nisab
 * that quietly used made-up numbers would be presented to the user as their own.
 */
export interface ManualMetalPriceInput {
  goldPerGram?: string
  silverPerGram?: string
  currency: string
  observedAt?: Date
}

export class ManualMetalPriceProvider implements MetalPriceProvider {
  readonly name = 'manual' as const

  constructor(private readonly input: ManualMetalPriceInput) {}

  getGoldPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('GOLD', this.input.goldPerGram, currency)
  }

  getSilverPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('SILVER', this.input.silverPerGram, currency)
  }

  private async priceOf(
    metal: Metal,
    pricePerGram: string | undefined,
    currency: string,
  ): Promise<MetalPrice> {
    const target = currency.toUpperCase()

    if (!pricePerGram) {
      throw new MetalPriceUnavailableError(metal, target, 'handmatige prijs ontbreekt')
    }

    // Converting a hand-entered price into another currency would attribute a
    // number to the user that they did not enter.
    if (this.input.currency.toUpperCase() !== target) {
      throw new MetalPriceUnavailableError(
        metal,
        target,
        `handmatige prijs is ingevoerd in ${this.input.currency}`,
      )
    }

    return {
      metal,
      pricePerGram,
      currency: target,
      provider: this.name,
      sourceType: 'MANUAL',
      observedAt: this.input.observedAt ?? new Date(),
    }
  }
}
