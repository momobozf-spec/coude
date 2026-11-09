/**
 * Geldbedragen en eenheden.
 *
 * ─── HET PROBLEEM DAT DIT BESTAND OPLOST ─────────────────────────────────────
 *
 * Halal Home hanteert twee eenheden, allebei met goede reden:
 *
 *   CENT (Int)  — alles wat de gebruiker invoert of wat we uitrekenen:
 *                 budget, eigen middelen, maandlasten, totalen. Precies, en
 *                 optellen geeft geen drift.
 *
 *   EURO (Int)  — vastgoedprijzen en fiscale grondslagen. Advertenties noteren
 *                 nooit centen, en registratierechten worden op hele euro's
 *                 berekend. Zie de kop van prisma/schema.prisma, regel 1.
 *
 * Twee eenheden in één systeem is een bekende bron van fouten van precies factor
 * honderd — en een budget van 4.500 € dat als 450.000 € wordt gelezen, is geen
 * afrondingsverschil maar een verkeerd huis.
 *
 * Daarom:
 *   1. elke variabele die centen bevat heet `...Cents`. Zonder uitzondering.
 *   2. omzetten gebeurt uitsluitend via de functies hieronder;
 *   3. `eurosFromCents` weigert bedragen die geen heel aantal euro's zijn, zodat
 *      een stille afronding niet ongemerkt in een fiscale berekening belandt.
 */

export const CENTS_PER_EURO = 100

/** Bovengrens voor elk bedrag: 50 miljoen euro. Alles daarboven is invoerfout. */
export const MAX_AMOUNT_CENTS = 50_000_000 * CENTS_PER_EURO

export class MoneyError extends Error {}

/** Hele euro's → centen. */
export function centsFromEuros(euros: number): number {
  if (!Number.isFinite(euros)) throw new MoneyError('Bedrag is geen getal')
  if (!Number.isInteger(euros)) {
    throw new MoneyError(`Verwachtte een heel aantal euro's, kreeg ${euros}`)
  }
  return euros * CENTS_PER_EURO
}

/**
 * Centen → hele euro's, voor de calculators die in euro's rekenen.
 *
 * Gooit bij een bedrag met centen in plaats van stil af te ronden. Een
 * kostenraming die 2 cent verschilt is onbelangrijk; een omzetting die
 * stilzwijgend afrondt is een gewoonte die later wél iets kost.
 */
export function eurosFromCents(cents: number): number {
  assertValidAmountCents(cents)
  if (cents % CENTS_PER_EURO !== 0) {
    throw new MoneyError(
      `${cents} cent is geen heel aantal euro's. Gebruik roundToWholeEuros() als afronden hier bedoeld is.`,
    )
  }
  return cents / CENTS_PER_EURO
}

/** Expliciet afronden naar hele euro's. De naam maakt de bedoeling zichtbaar. */
export function roundToWholeEuros(cents: number): number {
  assertValidAmountCents(cents)
  return Math.round(cents / CENTS_PER_EURO)
}

export function assertValidAmountCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new MoneyError(`Bedrag in centen moet een geheel getal zijn, kreeg ${cents}`)
  }
  if (cents < 0) throw new MoneyError('Bedrag mag niet negatief zijn')
  if (cents > MAX_AMOUNT_CENTS) {
    throw new MoneyError('Bedrag is onwaarschijnlijk hoog — vermoedelijk een invoerfout')
  }
}

/**
 * Leest wat een gebruiker in een formulier typt en geeft centen terug.
 *
 * Accepteert de vormen die mensen werkelijk intikken: "450000", "450.000",
 * "450 000", "450.000,50", "€ 450.000". Belgische conventie: punt is
 * duizendtal, komma is decimaal.
 *
 * Geeft null bij lege invoer, gooit bij onzin. Het verschil is belangrijk: een
 * leeg veld is "nog niet ingevuld", een onleesbaar veld is een fout die de
 * gebruiker moet zien.
 */
export function parseAmountToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new MoneyError('Bedrag is geen getal')
    return Math.round(input * CENTS_PER_EURO)
  }

  const trimmed = input.trim()
  if (trimmed === '') return null

  const cleaned = trimmed
    .replace(/[€\s ]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '') // duizendtalpunt
    .replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new MoneyError(`"${input}" is geen geldig bedrag`)
  }

  // Via string naar centen in plaats van `* 100`: 19.99 * 100 is 1998.9999…
  const [whole = '0', fraction = ''] = cleaned.split('.')
  const cents = Number(whole) * CENTS_PER_EURO + Number(fraction.padEnd(2, '0'))

  assertValidAmountCents(cents)
  return cents
}

/**
 * Munteenheden die de formatter kent.
 *
 * België is de enige markt, dus EUR is de enige waarde die er nu toe doet. De
 * code staat toch overal expliciet, want een valutasymbool dat in de
 * businesslogica gebakken zit, is bij uitbreiding niet meer te vinden. De
 * rekenlogica kent geen "€"; alleen deze functie vertaalt.
 */
export const SUPPORTED_CURRENCIES = ['EUR'] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: Currency = 'EUR'

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/**
 * Bedrag in centen, leesbaar. Laat de centen weg wanneer ze nul zijn.
 *
 * Een onbekende munteenheid wordt niet geweigerd maar doorgegeven aan `Intl`:
 * die valt terug op de code zelf ("USD 1.234"), en dat is bruikbaarder dan een
 * fout op een scherm dat verder klopt.
 */
export function formatCents(
  cents: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (cents === null || cents === undefined) return '—'
  const showDecimals = cents % CENTS_PER_EURO !== 0

  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(cents / CENTS_PER_EURO)
}

/**
 * Bedrag zonder valutasymbool, voor schermlezers en invoervelden.
 *
 * `formatCents` levert "€ 450.000", en een schermlezer maakt daar soms
 * "euro 450 000" of alleen "450.000" van. Waar de eenheid uitgesproken moet
 * worden, zetten we hem als woord in de tekst.
 */
export function formatCentsAccessible(
  cents: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (cents === null || cents === undefined) return 'onbekend'

  const amount = new Intl.NumberFormat('nl-BE', {
    minimumFractionDigits: cents % CENTS_PER_EURO === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / CENTS_PER_EURO)

  return currency === 'EUR' ? `${amount} euro` : `${amount} ${currency}`
}
