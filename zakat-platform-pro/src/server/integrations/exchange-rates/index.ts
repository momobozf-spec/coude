import 'server-only'

import { serverEnv } from '@/config/env'
import { FixtureExchangeRateProvider } from '@/server/integrations/exchange-rates/fixture'
import type { ExchangeRateProvider } from '@/server/integrations/exchange-rates/types'
import {
  PublishedExchangeRateProvider,
  databasePublishedPriceSource,
} from '@/server/integrations/published-prices'

export * from '@/server/integrations/exchange-rates/types'
export { FixtureExchangeRateProvider } from '@/server/integrations/exchange-rates/fixture'
export { ManualExchangeRateProvider } from '@/server/integrations/exchange-rates/manual'

/**
 * Resolve the configured provider.
 *
 * `frankfurter` is a free, keyless ECB mirror and is the intended live provider,
 * but it is not implemented in phase 2 — selecting it fails loudly rather than
 * silently degrading to fixture data, because a calculation that quietly used
 * made-up rates while claiming a live source is worse than one that refuses.
 */
export function getExchangeRateProvider(): ExchangeRateProvider {
  const { FX_PROVIDER, MAX_PRICE_AGE_DAYS } = serverEnv()

  switch (FX_PROVIDER) {
    case 'fixture':
      return new FixtureExchangeRateProvider()
    case 'published':
      return new PublishedExchangeRateProvider(databasePublishedPriceSource, MAX_PRICE_AGE_DAYS)
    case 'frankfurter':
      // Frankfurter vult de gepubliceerde koersen aan (FX_SYNC=frankfurter); een
      // berekening rekent altijd met wat er gepubliceerd staat, zodat elke koers
      // een vaste datum en bron heeft.
      throw new Error(
        'FX_PROVIDER=frankfurter bestaat niet als live bron. Zet FX_PROVIDER=published en ' +
          'FX_SYNC=frankfurter om de ECB-koersen automatisch te laten publiceren.',
      )
    default:
      return new FixtureExchangeRateProvider()
  }
}
