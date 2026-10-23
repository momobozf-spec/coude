import 'server-only'

import { serverEnv } from '@/config/env'
import { FixtureMetalPriceProvider } from '@/server/integrations/metal-prices/fixture'
import { ManualMetalPriceProvider } from '@/server/integrations/metal-prices/manual'
import type { MetalPriceProvider } from '@/server/integrations/metal-prices/types'
import { getExchangeRateProvider } from '@/server/integrations/exchange-rates'
import {
  PublishedMetalPriceProvider,
  databasePublishedPriceSource,
} from '@/server/integrations/published-prices'

export * from '@/server/integrations/metal-prices/types'
export { FixtureMetalPriceProvider } from '@/server/integrations/metal-prices/fixture'
export { ManualMetalPriceProvider } from '@/server/integrations/metal-prices/manual'

/**
 * Resolve the configured provider.
 *
 * `metalprice` is a paid API and is deliberately not wired up: selecting it
 * without credentials fails loudly rather than silently serving fixture numbers
 * under a live-source label (§6, §23).
 */
export function getMetalPriceProvider(
  manual?: { goldPerGram?: string; silverPerGram?: string; currency: string },
): MetalPriceProvider {
  const env = serverEnv()

  if (manual) return new ManualMetalPriceProvider(manual)

  switch (env.METAL_PRICE_PROVIDER) {
    case 'fixture':
      return new FixtureMetalPriceProvider(getExchangeRateProvider())

    case 'published':
      return new PublishedMetalPriceProvider(
        databasePublishedPriceSource,
        getExchangeRateProvider(),
        env.MAX_PRICE_AGE_DAYS,
      )

    case 'manual':
      throw new Error(
        'METAL_PRICE_PROVIDER=manual vereist handmatig ingevoerde prijzen bij de berekening.',
      )

    case 'metalprice':
      if (!env.METAL_PRICE_API_KEY) {
        throw new Error(
          'METAL_PRICE_PROVIDER=metalprice vereist METAL_PRICE_API_KEY. ' +
            'Zonder sleutel wordt er bewust niet teruggevallen op fixture-prijzen.',
        )
      }
      throw new Error(
        'METAL_PRICE_PROVIDER=metalprice is nog niet geïmplementeerd (fase 2 levert fixture en manual).',
      )

    default:
      return new FixtureMetalPriceProvider(getExchangeRateProvider())
  }
}
