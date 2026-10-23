import { describe, expect, it } from 'vitest'

import {
  PublishedExchangeRateProvider,
  PublishedMetalPriceProvider,
  ageInDays,
  type PublishedPriceSource,
  type PublishedRow,
} from '@/server/integrations/published-prices/core'
import { fetchEcbRates } from '@/server/integrations/published-prices/frankfurter'

const TODAY = new Date('2026-10-05T10:00:00.000Z')
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function sourceOf(rows: Record<string, PublishedRow>): PublishedPriceSource {
  return {
    async latest(kind, currency) {
      return rows[`${kind}:${currency}`] ?? null
    },
  }
}

describe('leeftijd van een publicatie', () => {
  it('telt kalenderdagen, niet uren', () => {
    expect(ageInDays(day('2026-10-05'), TODAY)).toBe(0)
    expect(ageInDays(day('2026-10-04'), new Date('2026-10-05T00:30:00Z'))).toBe(1)
    expect(ageInDays(day('2026-10-01'), TODAY)).toBe(4)
  })
})

describe('gepubliceerde wisselkoersen', () => {
  const rows = {
    'FX_PER_EUR:USD': { value: '1.10', effectiveDate: day('2026-10-03'), source: 'ECB' },
    'FX_PER_EUR:MAD': { value: '10.80', effectiveDate: day('2026-10-04'), source: 'BAM' },
    'FX_PER_EUR:GBP': { value: '0.85', effectiveDate: day('2026-09-20'), source: 'ECB' },
  }
  const provider = new PublishedExchangeRateProvider(sourceOf(rows), 4, () => TODAY)

  it('geeft EUR → valuta rechtstreeks', async () => {
    const rate = await provider.getRate('EUR', 'USD')
    expect(rate.rate).toBe('1.10000000')
    expect(rate.provider).toBe('published')
    expect(rate.observedAt.toISOString()).toBe('2026-10-03T00:00:00.000Z')
  })

  it('geeft valuta → EUR als omgekeerde', async () => {
    expect((await provider.getRate('USD', 'EUR')).rate).toBe('0.90909091')
  })

  it('kruist twee valuta via EUR en neemt de oudste datum', async () => {
    const rate = await provider.getRate('USD', 'MAD')
    // 10.80 / 1.10 = 9.818181818…
    expect(rate.rate).toBe('9.81818182')
    expect(rate.observedAt.toISOString()).toBe('2026-10-03T00:00:00.000Z')
  })

  it('weigert een verouderde koers in plaats van ermee te rekenen', async () => {
    await expect(provider.getRate('EUR', 'GBP')).rejects.toThrow(/geen recente koers voor GBP/)
  })

  it('weigert een valuta zonder publicatie', async () => {
    await expect(provider.getRate('EUR', 'TRY')).rejects.toThrow(/TRY/)
  })

  it('geeft 1 voor dezelfde valuta, zonder publicatie nodig', async () => {
    expect((await provider.getRate('SAR', 'SAR')).rate).toBe('1')
  })
})

describe('gepubliceerde metaalprijzen', () => {
  const rows = {
    'GOLD_PER_GRAM:EUR': { value: '98.4512', effectiveDate: day('2026-10-05'), source: 'LBMA' },
    'SILVER_PER_GRAM:EUR': { value: '1.12', effectiveDate: day('2026-09-25'), source: 'LBMA' },
    'FX_PER_EUR:MAD': { value: '10.80', effectiveDate: day('2026-10-04'), source: 'BAM' },
  }
  const source = sourceOf(rows)
  const fx = new PublishedExchangeRateProvider(source, 4, () => TODAY)
  const provider = new PublishedMetalPriceProvider(source, fx, 4, () => TODAY)

  it('levert de goudprijs in EUR met bron-type PUBLISHED', async () => {
    const price = await provider.getGoldPrice('EUR')
    expect(price.pricePerGram).toBe('98.451200')
    expect(price.sourceType).toBe('PUBLISHED')
    expect(price.observedAt.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })

  it('rekent om naar een andere valuta en neemt de oudste datum', async () => {
    const price = await provider.getGoldPrice('MAD')
    // 98.4512 × 10.80 = 1063.27296
    expect(price.pricePerGram).toBe('1063.272960')
    expect(price.observedAt.toISOString()).toBe('2026-10-04T00:00:00.000Z')
  })

  it('weigert een verouderde zilverprijs met de leeftijd in de melding', async () => {
    await expect(provider.getSilverPrice('EUR')).rejects.toThrow(/10 dagen oud/)
  })

  it('weigert wanneer er nooit iets gepubliceerd werd', async () => {
    const empty = new PublishedMetalPriceProvider(sourceOf({}), fx, 4, () => TODAY)
    await expect(empty.getGoldPrice('EUR')).rejects.toThrow(/nog geen prijs gepubliceerd/)
  })

  it('weigert om te rekenen zonder recente koers', async () => {
    await expect(provider.getGoldPrice('USD')).rejects.toThrow(/geen recente wisselkoers/)
  })
})

describe('ECB-koersen ophalen', () => {
  function fakeFetch(body: unknown, status = 200): typeof fetch {
    return (async (input: URL | RequestInfo) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('base')).toBe('EUR')
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch
  }

  it('zet een geldig antwoord om in koersen met de ECB-datum', async () => {
    const result = await fetchEcbRates(
      ['USD', 'GBP', 'TRY'],
      fakeFetch({ amount: 1, base: 'EUR', date: '2026-10-02', rates: { USD: 1.1712, GBP: 0.8721 } }),
    )
    expect(result.quotes).toEqual([
      { currency: 'USD', perEur: '1.1712', effectiveDate: '2026-10-02' },
      { currency: 'GBP', perEur: '0.8721', effectiveDate: '2026-10-02' },
    ])
    expect(result.missing).toEqual(['TRY'])
  })

  it('vraagt EUR nooit op en doet niets zonder valuta', async () => {
    const result = await fetchEcbRates(['EUR'], (() => {
      throw new Error('mag niet aangeroepen worden')
    }) as unknown as typeof fetch)
    expect(result).toEqual({ quotes: [], missing: [] })
  })

  it('weigert een antwoord in een onverwachte vorm', async () => {
    await expect(
      fetchEcbRates(['USD'], fakeFetch({ base: 'USD', date: '2026-10-02', rates: { EUR: 0.9 } })),
    ).rejects.toThrow(/onverwacht antwoord/)
  })

  it('meldt een HTTP-fout zonder iets te publiceren', async () => {
    await expect(fetchEcbRates(['USD'], fakeFetch({}, 503))).rejects.toThrow(/HTTP 503/)
  })
})
