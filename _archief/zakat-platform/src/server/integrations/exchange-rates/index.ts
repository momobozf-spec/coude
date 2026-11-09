import 'server-only'

import { serverEnv } from '@/config/env'
import { FixtureExchangeRateProvider } from '@/server/integrations/exchange-rates/fixture'
import type { ExchangeRateProvider } from '@/server/integrations/exchange-rates/types'

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
  const { FX_PROVIDER } = serverEnv()

  switch (FX_PROVIDER) {
    case 'fixture':
      return new FixtureExchangeRateProvider()
    case 'frankfurter':
      throw new Error(
        'FX_PROVIDER=frankfurter is nog niet geïmplementeerd (fase 2 levert fixture en manual). ' +
          'Zet FX_PROVIDER=fixture of voer koersen handmatig in.',
      )
    default:
      return new FixtureExchangeRateProvider()
  }
}
