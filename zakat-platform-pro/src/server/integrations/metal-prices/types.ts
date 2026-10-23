import type { MetalPriceSourceType } from '@/generated/prisma/client'

/**
 * Precious metal price provider abstraction (§6).
 *
 * The price is always returned per gram, with the provider that produced it and
 * the moment it was observed. Those three facts are written into the calculation
 * snapshot, so a historical nisab can be shown with its provenance and can never
 * be silently restated when the market moves (§16, §23).
 */

export type Metal = 'GOLD' | 'SILVER'

export type MetalPriceProviderName = 'fixture' | 'manual' | 'metalprice' | 'published'

export interface MetalPrice {
  metal: Metal
  /** Decimal string at METAL_PRICE scale (6 dp). Never a JS number. */
  pricePerGram: string
  currency: string
  provider: MetalPriceProviderName
  /** How this price should be labelled in the UI. */
  sourceType: MetalPriceSourceType
  observedAt: Date
}

export interface MetalPriceProvider {
  readonly name: MetalPriceProviderName
  getGoldPrice(currency: string, date?: Date): Promise<MetalPrice>
  getSilverPrice(currency: string, date?: Date): Promise<MetalPrice>
}

export class MetalPriceUnavailableError extends Error {
  readonly metal: Metal
  readonly currency: string

  constructor(metal: Metal, currency: string, reason?: string) {
    super(
      `Geen ${metal === 'GOLD' ? 'goud' : 'zilver'}prijs beschikbaar in ${currency}` +
        `${reason ? ` (${reason})` : ''}.`,
    )
    this.name = 'MetalPriceUnavailableError'
    this.metal = metal
    this.currency = currency
  }
}
