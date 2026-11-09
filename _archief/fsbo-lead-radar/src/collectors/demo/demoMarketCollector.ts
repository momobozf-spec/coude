/**
 * Demo-collector: produceert nieuwe, plausibele Belgische advertenties.
 *
 * ─── WAAROM DIT BESTAAT ──────────────────────────────────────────────────────
 *
 * De fixture-collector geeft elke run dezelfde tien advertenties. Dat is
 * perfect voor tests en nutteloos om te zien wat de dienst dóét: het hele punt
 * is dat er *nieuw* aanbod binnenkomt en dat er binnen seconden een alert
 * uitgaat. Deze collector genereert daarom bij elke run een handvol verse
 * advertenties, met realistische verdeling over particulier/professioneel,
 * prijzen die bij de postcode passen, en soms een duplicaat van iets dat al
 * bestaat.
 *
 * Hij raakt het netwerk niet aan. Alles wordt lokaal opgebouwd.
 *
 * ─── DETERMINISME ────────────────────────────────────────────────────────────
 *
 * De generator gebruikt een eigen PRNG met een expliciete seed in plaats van
 * `Math.random()`. Dat is geen purisme: zonder seed kan je een run die iets
 * geks opleverde niet nadraaien, en dan debug je een pijplijn waarvan de invoer
 * elke keer anders is.
 */
import type { RawListing } from '@/domain/types'

import type { CollectorContext, CollectorDefinition, CollectorResult } from '../types'

/** mulberry32 — klein, snel, en goed genoeg voor demo-data. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Place {
  postalCode: string
  city: string
  streets: string[]
  /** Mediane vraagprijs voor een gemiddelde woning in deze gemeente. */
  priceAnchor: number
}

const PLACES: readonly Place[] = [
  { postalCode: '9000', city: 'Gent', streets: ['Brugsepoortstraat', 'Nieuwewandeling', 'Kortrijksesteenweg', 'Sint-Lievenslaan'], priceAnchor: 345_000 },
  { postalCode: '9040', city: 'Sint-Amandsberg', streets: ['Antwerpsesteenweg', 'Dendermondsesteenweg'], priceAnchor: 295_000 },
  { postalCode: '2000', city: 'Antwerpen', streets: ['Kammenstraat', 'Volkstraat', 'Nationalestraat'], priceAnchor: 365_000 },
  { postalCode: '2600', city: 'Berchem', streets: ['Statiestraat', 'Grotesteenweg'], priceAnchor: 320_000 },
  { postalCode: '3000', city: 'Leuven', streets: ['Tiensestraat', 'Naamsestraat', 'Diestsestraat'], priceAnchor: 395_000 },
  { postalCode: '8500', city: 'Kortrijk', streets: ['Doorniksewijk', 'Gentsesteenweg'], priceAnchor: 275_000 },
  { postalCode: '8000', city: 'Brugge', streets: ['Smedenstraat', 'Ezelstraat'], priceAnchor: 330_000 },
  { postalCode: '3500', city: 'Hasselt', streets: ['Kempische Steenweg', 'Runkstersteenweg'], priceAnchor: 285_000 },
  { postalCode: '9300', city: 'Aalst', streets: ['Molenstraat', 'Gentsesteenweg'], priceAnchor: 255_000 },
  { postalCode: '1000', city: 'Brussel', streets: ['Anspachlaan', 'Dansaertstraat'], priceAnchor: 385_000 },
  { postalCode: '4000', city: 'Luik', streets: ['Rue Saint-Léonard', 'Boulevard de la Sauvenière'], priceAnchor: 235_000 },
  { postalCode: '9100', city: 'Sint-Niklaas', streets: ['Klapperbeekstraat', 'Parklaan'], priceAnchor: 265_000 },
]

const PROPERTY_TYPES = [
  { label: 'Appartement', minSurface: 55, maxSurface: 130, minBedrooms: 1, maxBedrooms: 3, priceFactor: 0.95 },
  { label: 'Huis', minSurface: 110, maxSurface: 240, minBedrooms: 2, maxBedrooms: 5, priceFactor: 1.15 },
  { label: 'Rijwoning', minSurface: 95, maxSurface: 180, minBedrooms: 2, maxBedrooms: 4, priceFactor: 1.0 },
  { label: 'Studio', minSurface: 28, maxSurface: 50, minBedrooms: 0, maxBedrooms: 1, priceFactor: 0.55 },
] as const

const FIRST_NAMES = ['Elke', 'Tom', 'Marie', 'Bart', 'Sofie', 'Jonas', 'Nele', 'Wouter', 'Hanne', 'Karel', 'Lise', 'Pieter']
const LAST_NAMES = ['Peeters', 'Janssens', 'Maes', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'Vermeulen', 'Dubois']

const AGENCY_NAMES = [
  'Immo Horizon BV',
  'Vastgoedkantoor De Sleutel',
  'Century Estate Partners NV',
  'Agence Immobilière Meuse SRL',
  'Woonpunt Makelaars',
]

/** Zinnen die een particulier schrijft. De classificatie moet deze herkennen. */
const PRIVATE_PHRASES = [
  'Wij verkopen zelf, zonder makelaar.',
  'Particuliere verkoop, geen commissie.',
  'Van particulier aan particulier, geen immokantoor.',
  'Wegens verhuis verkopen wij onze eigen woning.',
  'Bel mij gerust na 18u, ik geef zelf de rondleidingen.',
]

/** En zinnen die een kantoor schrijft. */
const PROFESSIONAL_PHRASES = [
  'Bezoek op afspraak via ons kantoor.',
  'Ontdek ons volledig aanbod op onze website.',
  'Onze medewerkers begeleiden u van bezichtiging tot akte.',
  'Ref. 7734-B — vraag het volledige dossier op bij ons bureau.',
]

const NEUTRAL_PHRASES = [
  'Instapklaar en energiezuinig.',
  'Rustige ligging op wandelafstand van winkels en scholen.',
  'Voorzien van dubbele beglazing en centrale verwarming.',
  'Zuidgerichte tuin met terras.',
]

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)]
  // De index kan door afronding nooit buiten bereik vallen, maar het type
  // systeem weet dat niet en een niet-lege lijst is hier een aanname.
  if (item === undefined) throw new Error('Lege keuzelijst in de demo-generator')
  return item
}

function between(random: () => number, min: number, max: number): number {
  return Math.floor(min + random() * (max - min + 1))
}

/**
 * Belgische testnummers. 0475/0496/0498-reeksen zijn echte mobiele prefixen,
 * maar de laatste zes cijfers worden gegenereerd — de kans dat er een bestaand
 * nummer uitrolt is klein en de data verlaat de demo nooit.
 */
function demoPhone(random: () => number): string {
  const prefix = pick(random, ['0475', '0476', '0478', '0485', '0496', '0498'])
  return `${prefix} ${between(random, 10, 99)} ${between(random, 10, 99)} ${between(random, 10, 99)}`
}

export interface DemoGeneratorOptions {
  seed: number
  count: number
  now: Date
  sourceKey: string
  /** Aandeel particuliere advertenties. Realistischer dan 50/50: op publieke
   *  zoekertjessites is ongeveer een derde particulier. */
  privateRatio?: number
}

export function generateDemoListings(options: DemoGeneratorOptions): RawListing[] {
  const random = createRandom(options.seed)
  const privateRatio = options.privateRatio ?? 0.35
  const listings: RawListing[] = []

  for (let index = 0; index < options.count; index += 1) {
    const place = pick(random, PLACES)
    const propertyType = pick(random, PROPERTY_TYPES)
    const isPrivate = random() < privateRatio
    // Een klein deel blijft bewust dubbelzinnig: geen verkopersnaam, geen
    // duidelijke taal. Die horen op `unknown` uit te komen en dus niet
    // automatisch verstuurd te worden — dat wil je in een demo kunnen zien.
    const isAmbiguous = !isPrivate && random() < 0.25

    const isRent = random() < 0.25
    const surface = between(random, propertyType.minSurface, propertyType.maxSurface)
    const bedrooms = between(random, propertyType.minBedrooms, propertyType.maxBedrooms)

    // Prijs volgt de gemeente, het woningtype en de oppervlakte, met ±12% ruis.
    const basePrice = place.priceAnchor * propertyType.priceFactor * (surface / 120)
    const noise = 0.88 + random() * 0.24
    const salePrice = Math.round((basePrice * noise) / 1000) * 1000
    const rentPrice = Math.round((basePrice * noise) / 240 / 10) * 10
    const price = isRent ? Math.max(450, rentPrice) : Math.max(85_000, salePrice)

    const sellerName = isPrivate
      ? `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`
      : isAmbiguous
        ? undefined
        : pick(random, AGENCY_NAMES)

    const phone = isPrivate || random() < 0.7 ? demoPhone(random) : undefined

    const sentences = [
      pick(random, NEUTRAL_PHRASES),
      isPrivate ? pick(random, PRIVATE_PHRASES) : isAmbiguous ? '' : pick(random, PROFESSIONAL_PHRASES),
      phone && isPrivate ? `Bereikbaar op ${phone}.` : '',
    ].filter((sentence) => sentence.length > 0)

    const street = pick(random, place.streets)
    const houseNumber = between(random, 1, 220)

    // Publicatietijd: de meeste advertenties zijn vers (dat is het scenario dat
    // de dienst bedient), een enkele is ouder.
    const minutesAgo = random() < 0.75 ? between(random, 1, 12) : between(random, 60, 2880)

    listings.push({
      source: options.sourceKey,
      // Het id is deterministisch in seed+index, zodat een herhaalde run met
      // dezelfde seed dezelfde advertenties oplevert en de deduplicatie
      // aantoonbaar werkt in plaats van per toeval.
      sourceListingId: `demo-${options.seed}-${index}`,
      url: `https://demo.fsbo-lead-radar.local/zoekertjes/demo-${options.seed}-${index}`,
      title: `${propertyType.label} met ${bedrooms} slaapkamer${bedrooms === 1 ? '' : 's'} in ${place.city}`,
      description: `${propertyType.label} van ${surface} m² met ${bedrooms} slaapkamer${bedrooms === 1 ? '' : 's'}. ${sentences.join(' ')}`,
      price,
      currency: 'EUR',
      listingType: isRent ? 'rent' : 'sale',
      propertyType: propertyType.label,
      postalCode: place.postalCode,
      city: place.city,
      address: `${street} ${houseNumber}`,
      bedrooms,
      surfaceArea: surface,
      sellerName,
      sellerPhone: phone,
      sellerTypeHint: isPrivate ? 'private' : isAmbiguous ? 'unknown' : 'professional',
      sellerListingCount: isPrivate ? 1 : between(random, 5, 40),
      publishedAt: new Date(options.now.getTime() - minutesAgo * 60_000),
      scrapedAt: options.now,
    })
  }

  return listings
}

export const DEMO_SOURCE_KEY = 'demo-be'

export const demoMarketCollector: CollectorDefinition = {
  key: DEMO_SOURCE_KEY,
  name: 'Demomarkt België (gegenereerd)',
  accessMethod: 'SYNTHETIC',
  baseUrl: null,
  defaultPollIntervalSeconds: 120,
  defaultRateLimitPerMinute: 60,
  accessNotes:
    'Genereert lokaal verzonnen advertenties. Geen netwerkverkeer en geen externe partij. Bedoeld om de volledige pijplijn met vers aanbod te kunnen tonen; niet voor productiegebruik.',
  requiresBrowser: false,

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const now = new Date()

    // Seed per tijdvenster van vijf minuten: binnen één venster levert de bron
    // hetzelfde aanbod (zodat je ziet dat de deduplicatie werkt), daarna nieuw
    // aanbod (zodat je ziet dat er alerts uitgaan).
    const seed = Math.floor(now.getTime() / (5 * 60_000))
    const count = Math.min(context.maxItems, 6)

    const listings = generateDemoListings({ seed, count, now, sourceKey: DEMO_SOURCE_KEY })

    context.logger.debug('Demo-advertenties gegenereerd', { seed, count: listings.length })
    return { listings, warnings: [] }
  },
}
