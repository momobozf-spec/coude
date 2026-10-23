import { SCALE, divRound, fromScaled, pow10, toScaled } from '@/lib/decimal'
import {
  ExchangeRateUnavailableError,
  type ExchangeRate,
  type ExchangeRateProvider,
} from '@/server/integrations/exchange-rates/types'
import {
  MetalPriceUnavailableError,
  type Metal,
  type MetalPrice,
  type MetalPriceProvider,
} from '@/server/integrations/metal-prices/types'

/**
 * Door de beheerder gepubliceerde marktprijzen (goud, zilver, wisselkoersen).
 *
 * ─── WAAROM GEPUBLICEERD EN NIET LIVE ────────────────────────────────────────
 *
 * Een Zakat-berekening is een religieuze verplichting met een bedrag eraan. De
 * prijs waarop de nisab rust moet dus een herkenbare herkomst hebben: wie, welke
 * bron, welke dag. Een beheerder publiceert de dagprijs met die gegevens; de
 * wisselkoersen kunnen daarnaast automatisch uit de ECB-referentiekoersen komen
 * (zie `frankfurter.ts`). Elke berekening legt waarde en datum vast.
 *
 * ─── VEROUDERDE PRIJZEN ──────────────────────────────────────────────────────
 *
 * Is de recentste prijs ouder dan `maxAgeDays`, dan weigert de provider. Liever
 * geen berekening dan een nisab op de goudprijs van vorige maand, gepresenteerd
 * als die van vandaag.
 *
 * Deze module is puur: de bron van de rijen wordt meegegeven, zodat de regels
 * zonder database te testen zijn.
 */

export interface PublishedRow {
  /** Decimale string. */
  value: string
  /** Kalenderdag (UTC-middernacht) waarvoor de waarde geldt. */
  effectiveDate: Date
  source: string
}

export interface PublishedPriceSource {
  /** Recentste rij met `effectiveDate <= onOrBefore`, of null. */
  latest(
    kind: 'GOLD_PER_GRAM' | 'SILVER_PER_GRAM' | 'FX_PER_EUR',
    currency: string,
    onOrBefore: Date,
  ): Promise<PublishedRow | null>
}

const DAY_MS = 86_400_000

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** Hoeveel hele dagen `row` ouder is dan `today` (beide als kalenderdag). */
export function ageInDays(effectiveDate: Date, today: Date): number {
  return Math.round((utcDay(today).getTime() - utcDay(effectiveDate).getTime()) / DAY_MS)
}

export class PublishedExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'published' as const

  constructor(
    private readonly source: PublishedPriceSource,
    private readonly maxAgeDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Eenheden `currency` per 1 EUR, met de datum van de gebruikte rij. */
  private async perEur(currency: string): Promise<{ value: string; asOf: Date } | null> {
    if (currency === 'EUR') return { value: '1', asOf: utcDay(this.now()) }

    const today = this.now()
    const row = await this.source.latest('FX_PER_EUR', currency, today)
    if (!row) return null
    if (ageInDays(row.effectiveDate, today) > this.maxAgeDays) return null
    return { value: row.value, asOf: row.effectiveDate }
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const source = from.toUpperCase()
    const target = to.toUpperCase()

    if (source === target) {
      return { from: source, to: target, rate: '1', provider: this.name, observedAt: utcDay(this.now()) }
    }

    const [fromPerEur, toPerEur] = await Promise.all([this.perEur(source), this.perEur(target)])

    if (!fromPerEur) {
      throw new ExchangeRateUnavailableError(source, target, `geen recente koers voor ${source}`)
    }
    if (!toPerEur) {
      throw new ExchangeRateUnavailableError(source, target, `geen recente koers voor ${target}`)
    }

    // 1 source = (1/fromPerEur) EUR = (toPerEur/fromPerEur) target.
    const numerator = toScaled(toPerEur.value, SCALE.FX_RATE) * pow10(SCALE.FX_RATE)
    const denominator = toScaled(fromPerEur.value, SCALE.FX_RATE)
    if (denominator === 0n) {
      throw new ExchangeRateUnavailableError(source, target, 'ongeldige koers 0')
    }

    // De oudste van beide data: een kruiskoers is zo oud als zijn oudste been.
    const observedAt =
      fromPerEur.asOf.getTime() < toPerEur.asOf.getTime() ? fromPerEur.asOf : toPerEur.asOf

    return {
      from: source,
      to: target,
      rate: fromScaled(divRound(numerator, denominator), SCALE.FX_RATE),
      provider: this.name,
      observedAt,
    }
  }
}

const METAL_KIND: Record<Metal, 'GOLD_PER_GRAM' | 'SILVER_PER_GRAM'> = {
  GOLD: 'GOLD_PER_GRAM',
  SILVER: 'SILVER_PER_GRAM',
}

export class PublishedMetalPriceProvider implements MetalPriceProvider {
  readonly name = 'published' as const

  constructor(
    private readonly source: PublishedPriceSource,
    private readonly fx: ExchangeRateProvider,
    private readonly maxAgeDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getGoldPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('GOLD', currency)
  }

  getSilverPrice(currency: string): Promise<MetalPrice> {
    return this.priceOf('SILVER', currency)
  }

  private async priceOf(metal: Metal, currency: string): Promise<MetalPrice> {
    const target = currency.toUpperCase()
    const today = this.now()

    // Metalen worden in EUR gepubliceerd; andere valuta gaan via de koers.
    const row = await this.source.latest(METAL_KIND[metal], 'EUR', today)
    if (!row) {
      throw new MetalPriceUnavailableError(metal, target, 'er is nog geen prijs gepubliceerd')
    }

    const age = ageInDays(row.effectiveDate, today)
    if (age > this.maxAgeDays) {
      throw new MetalPriceUnavailableError(
        metal,
        target,
        `de laatst gepubliceerde prijs is ${age} dagen oud`,
      )
    }

    let pricePerGram = fromScaled(toScaled(row.value, SCALE.METAL_PRICE), SCALE.METAL_PRICE)
    let observedAt = row.effectiveDate

    if (target !== 'EUR') {
      let rate: ExchangeRate
      try {
        rate = await this.fx.getRate('EUR', target)
      } catch {
        throw new MetalPriceUnavailableError(metal, target, 'geen recente wisselkoers')
      }

      const scaledPrice = toScaled(row.value, SCALE.METAL_PRICE)
      const scaledRate = toScaled(rate.rate, SCALE.FX_RATE)
      pricePerGram = fromScaled(
        divRound(scaledPrice * scaledRate, pow10(SCALE.FX_RATE)),
        SCALE.METAL_PRICE,
      )
      if (rate.observedAt.getTime() < observedAt.getTime()) observedAt = rate.observedAt
    }

    return {
      metal,
      pricePerGram,
      currency: target,
      provider: this.name,
      sourceType: 'PUBLISHED',
      observedAt,
    }
  }
}
