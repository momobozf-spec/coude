import {
  ExchangeRateUnavailableError,
  type ExchangeRate,
  type ExchangeRateProvider,
} from '@/server/integrations/exchange-rates/types'

/**
 * Rates supplied by the user rather than fetched.
 *
 * Used when someone wants their calculation to reflect the rate their own bank
 * applied. Unknown pairs fail rather than falling back to a market source: a
 * silent substitution would misattribute a number the user believes they chose.
 */
export class ManualExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'manual' as const

  private readonly rates: Map<string, string>
  private readonly observedAt: Date

  constructor(rates: Record<string, string>, observedAt: Date = new Date()) {
    this.rates = new Map(
      Object.entries(rates).map(([pair, rate]) => [pair.toUpperCase(), rate]),
    )
    this.observedAt = observedAt
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const source = from.toUpperCase()
    const target = to.toUpperCase()

    if (source === target) {
      return { from: source, to: target, rate: '1', provider: this.name, observedAt: this.observedAt }
    }

    const rate = this.rates.get(`${source}/${target}`)
    if (!rate) {
      throw new ExchangeRateUnavailableError(source, target, 'handmatige koers ontbreekt')
    }

    return { from: source, to: target, rate, provider: this.name, observedAt: this.observedAt }
  }
}
