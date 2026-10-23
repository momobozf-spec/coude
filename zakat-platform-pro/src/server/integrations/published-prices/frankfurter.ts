import { z } from 'zod'

/**
 * ECB-referentiekoersen via frankfurter.dev — een gratis, sleutelloze spiegel
 * van de dagelijkse koersen die de Europese Centrale Bank publiceert.
 *
 * Gebruikt door de worker (FX_SYNC=frankfurter) om de gepubliceerde
 * wisselkoersen dagelijks aan te vullen. Een berekening haalt nooit zelf iets op:
 * ze rekent met wat gepubliceerd staat, zodat elke koers een vaste datum heeft.
 *
 * Let op: de ECB publiceert géén koers voor MAD, SAR en AED. Die vult de
 * beheerder zelf in; de sync slaat ze over en meldt dat.
 *
 * Deze module is puur (fetch wordt meegegeven) en dus zonder netwerk te testen.
 */

export const FRANKFURTER_DEFAULT_URL = 'https://api.frankfurter.dev/v1/latest'

const responseSchema = z.object({
  base: z.literal('EUR'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string(), z.number().positive().finite()),
})

export interface FxQuote {
  currency: string
  /** Eenheden `currency` per 1 EUR, als decimale string. */
  perEur: string
  /** `yyyy-mm-dd` zoals de ECB hem publiceerde. */
  effectiveDate: string
}

export interface FxFetchResult {
  quotes: FxQuote[]
  /** Gevraagde valuta waarvoor de bron geen koers gaf. */
  missing: string[]
}

/** Getal naar decimale string zonder wetenschappelijke notatie. */
function decimalString(value: number): string {
  const text = value.toString()
  if (!/e/i.test(text)) return text
  return value.toFixed(8)
}

export async function fetchEcbRates(
  currencies: readonly string[],
  fetchImpl: typeof fetch = fetch,
  url: string = FRANKFURTER_DEFAULT_URL,
): Promise<FxFetchResult> {
  const wanted = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c !== 'EUR'))]
  if (wanted.length === 0) return { quotes: [], missing: [] }

  const query = new URL(url)
  query.searchParams.set('base', 'EUR')
  query.searchParams.set('symbols', wanted.join(','))

  const response = await fetchImpl(query, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Wisselkoersbron antwoordde met HTTP ${response.status}`)
  }

  const parsed = responseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error('Wisselkoersbron gaf een onverwacht antwoord; er is niets gepubliceerd.')
  }

  const quotes: FxQuote[] = []
  const missing: string[] = []

  for (const currency of wanted) {
    const rate = parsed.data.rates[currency]
    if (rate === undefined) {
      missing.push(currency)
      continue
    }
    quotes.push({ currency, perEur: decimalString(rate), effectiveDate: parsed.data.date })
  }

  return { quotes, missing }
}

/**
 * De valuta die de ECB publiceert. Alleen deze worden bij de bron gevraagd; een
 * vraag met een onbekende valuta zou de hele aanvraag laten falen.
 */
export const ECB_CURRENCIES = new Set([
  'USD', 'JPY', 'BGN', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK', 'CHF', 'ISK',
  'NOK', 'TRY', 'AUD', 'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN',
  'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'ZAR',
])
