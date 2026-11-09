import { isSupportedCurrency } from '@/config/currencies'
import {
  ExchangeRateUnavailableError,
  type ExchangeRate,
  type ExchangeRateProvider,
} from '@/server/integrations/exchange-rates/types'
import { toScaled, fromScaled, divRound, SCALE, pow10 } from '@/lib/decimal'

/**
 * Deterministic exchange rates for development and tests.
 *
 * These are plausible round numbers, not market data, and the provider name is
 * carried through to the UI so a fixture is never presented as a live source
 * (§23). Rates are held against EUR and crossed through it, so the table stays
 * small and every pair is consistent with every other.
 */

const EUR_PER_UNIT: Record<string, string> = {
  EUR: '1',
  USD: '0.92',
  GBP: '1.17',
  MAD: '0.092',
  TRY: '0.026',
  SAR: '0.245',
  AED: '0.250',
}

/** Frozen so a fixture-backed calculation is byte-identical on every run. */
export const FIXTURE_FX_OBSERVED_AT = new Date('2026-01-01T00:00:00.000Z')

export class FixtureExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'fixture' as const

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const source = from.toUpperCase()
    const target = to.toUpperCase()

    if (!isSupportedCurrency(source)) throw new ExchangeRateUnavailableError(source, target, 'onbekende valuta')
    if (!isSupportedCurrency(target)) throw new ExchangeRateUnavailableError(source, target, 'onbekende valuta')

    // Identity short-circuit: a currency is always exactly 1 against itself, and
    // must never pick up a rounding artefact from crossing through EUR.
    if (source === target) {
      return {
        from: source,
        to: target,
        rate: '1',
        provider: this.name,
        observedAt: FIXTURE_FX_OBSERVED_AT,
      }
    }

    const fromEur = EUR_PER_UNIT[source]
    const toEur = EUR_PER_UNIT[target]

    if (!fromEur || !toEur) throw new ExchangeRateUnavailableError(source, target)

    // rate = (EUR per source) / (EUR per target), at FX scale.
    const numerator = toScaled(fromEur, SCALE.FX_RATE) * pow10(SCALE.FX_RATE)
    const denominator = toScaled(toEur, SCALE.FX_RATE)

    return {
      from: source,
      to: target,
      rate: fromScaled(divRound(numerator, denominator), SCALE.FX_RATE),
      provider: this.name,
      observedAt: FIXTURE_FX_OBSERVED_AT,
    }
  }
}
