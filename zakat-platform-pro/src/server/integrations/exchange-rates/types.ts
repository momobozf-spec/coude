/**
 * Exchange rate provider abstraction (§7).
 *
 * A rate is always returned with its provider and observation time, because a
 * finalised calculation must record *which* rate it used and where it came from.
 * Historical results are never recomputed against today's rates (§16).
 */

export type FxProviderName = 'fixture' | 'manual' | 'frankfurter' | 'published'

export interface ExchangeRate {
  from: string
  to: string
  /** Decimal string at FX_RATE scale (8 dp). Never a JS number. */
  rate: string
  provider: FxProviderName
  observedAt: Date
}

export interface ExchangeRateProvider {
  readonly name: FxProviderName
  getRate(from: string, to: string, date?: Date): Promise<ExchangeRate>
}

export class ExchangeRateUnavailableError extends Error {
  readonly from: string
  readonly to: string

  constructor(from: string, to: string, reason?: string) {
    super(
      `Geen wisselkoers beschikbaar voor ${from} → ${to}${reason ? ` (${reason})` : ''}.`,
    )
    this.name = 'ExchangeRateUnavailableError'
    this.from = from
    this.to = to
  }
}
