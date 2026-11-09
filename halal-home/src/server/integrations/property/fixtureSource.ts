/**
 * De fixture-bron: een vaste set panden, zonder netwerk.
 *
 * Bestaat om drie redenen:
 *   1. de zoekflow is volledig te ontwikkelen en te testen zonder externe bron;
 *   2. tests krijgen voorspelbare data die niet verandert wanneer de markt
 *      verandert;
 *   3. het bewijst dat de `PropertySource`-abstractie klopt — als de fixture er
 *      doorheen past, past een echte API er ook doorheen.
 *
 * De panden hieronder zijn VERZONNEN. Adressen wijzen naar example.com en de
 * straatnamen bestaan niet. Zie de kop van prisma/seed-data/financing.ts voor
 * waarom we geen echte data in code zetten.
 */
import type {
  PropertySource,
  RawPropertyListing,
  SourceSearchContext,
  SourceSearchResult,
} from '@/types/propertySource'
import type { SearchCriteria } from '@/modules/search/schemas/searchCriteria'

const FIXTURES: RawPropertyListing[] = [
  {
    externalId: 'fixture-001',
    url: 'https://example.com/woning/fixture-001',
    title: 'Ruime woning met tuin nabij centrum Gent',
    description:
      'Instapklare woning met 4 slaapkamers, zuidgerichte tuin en zonnepanelen. EPC A. Op wandelafstand van scholen en winkels.',
    address: 'Voorbeeldstraat 12',
    postalCode: '9000',
    city: 'Gent',
    region: 'FLANDERS',
    latitude: 51.0543,
    longitude: 3.7174,
    propertyType: 'house',
    price: 415_000,
    bedrooms: 4,
    bathrooms: 1,
    livingAreaM2: 178,
    landAreaM2: 320,
    epcLabel: 'A',
    epcValue: 92,
    buildYear: 1998,
    features: ['garden', 'solar_panels', 'renovated'],
  },
  {
    externalId: 'fixture-002',
    url: 'https://example.com/woning/fixture-002',
    title: 'Nieuwbouwappartement met terras, Gentbrugge',
    description:
      'Energiezuinig appartement met 3 slaapkamers, terras en ondergrondse parking. Vlot bereikbaar met het openbaar vervoer.',
    address: 'Voorbeeldlaan 44',
    postalCode: '9050',
    city: 'Gentbrugge',
    region: 'FLANDERS',
    latitude: 51.0362,
    longitude: 3.7515,
    propertyType: 'apartment',
    price: 389_000,
    bedrooms: 3,
    bathrooms: 2,
    livingAreaM2: 124,
    epcLabel: 'A+',
    epcValue: 48,
    buildYear: 2023,
    features: ['terrace', 'parking', 'elevator', 'new_build', 'heat_pump'],
  },
  {
    externalId: 'fixture-003',
    url: 'https://example.com/woning/fixture-003',
    title: 'Te renoveren rijwoning, Sint-Amandsberg',
    description:
      'Rijwoning met veel potentieel op een goede locatie. Renovatie noodzakelijk. 3 slaapkamers en een kleine stadstuin.',
    address: 'Voorbeeldplein 7',
    postalCode: '9040',
    city: 'Sint-Amandsberg',
    region: 'FLANDERS',
    latitude: 51.0625,
    longitude: 3.7469,
    propertyType: 'house',
    price: 279_000,
    bedrooms: 3,
    bathrooms: 1,
    livingAreaM2: 132,
    landAreaM2: 145,
    epcLabel: 'E',
    epcValue: 410,
    buildYear: 1932,
    features: ['garden'],
  },
  {
    externalId: 'fixture-004',
    url: 'https://example.com/woning/fixture-004',
    title: 'Gezinswoning met vier slaapkamers, Leuven',
    description:
      'Ruime woning op wandelafstand van het centrum. Vier slaapkamers, garage en aangelegde tuin. Dichtbij scholen.',
    address: 'Voorbeeldweg 88',
    postalCode: '3000',
    city: 'Leuven',
    region: 'FLANDERS',
    latitude: 50.8798,
    longitude: 4.7005,
    propertyType: 'house',
    price: 478_000,
    bedrooms: 4,
    bathrooms: 2,
    livingAreaM2: 195,
    landAreaM2: 410,
    epcLabel: 'B',
    epcValue: 168,
    buildYear: 2004,
    features: ['garden', 'garage', 'terrace'],
  },
  {
    externalId: 'fixture-005',
    url: 'https://example.com/woning/fixture-005',
    title: 'Compact appartement in Antwerpen-Noord',
    description: 'Instapklaar appartement met twee slaapkamers en balkon. Vlakbij tram en winkels.',
    address: 'Voorbeeldkaai 3',
    postalCode: '2060',
    city: 'Antwerpen',
    region: 'FLANDERS',
    latitude: 51.2298,
    longitude: 4.4291,
    propertyType: 'apartment',
    price: 265_000,
    bedrooms: 2,
    bathrooms: 1,
    livingAreaM2: 86,
    epcLabel: 'C',
    epcValue: 245,
    buildYear: 1975,
    features: ['balcony', 'elevator'],
  },
  {
    externalId: 'fixture-006',
    url: 'https://example.com/woning/fixture-006',
    title: 'Villa met grote tuin, Brasschaat',
    description: 'Vrijstaande villa op ruim perceel. Vijf slaapkamers, dubbele garage, zwembad.',
    address: 'Voorbeelddreef 21',
    postalCode: '2930',
    city: 'Brasschaat',
    region: 'FLANDERS',
    latitude: 51.2917,
    longitude: 4.4972,
    propertyType: 'villa',
    price: 895_000,
    bedrooms: 5,
    bathrooms: 3,
    livingAreaM2: 340,
    landAreaM2: 1_450,
    epcLabel: 'B',
    epcValue: 152,
    buildYear: 2011,
    features: ['garden', 'garage', 'swimming_pool', 'detached'],
  },
]

export class FixturePropertySource implements PropertySource {
  readonly name = 'fixture'

  constructor(private readonly listings: RawPropertyListing[] = FIXTURES) {}

  /**
   * Filtert de fixtures grof op scope.
   *
   * Bewust alleen op transactietype en locatie: de echte matching gebeurt in
   * `matchProperty`, en die moet ook draaien op panden die de bron oplevert
   * zonder ze te filteren. Een bron die te streng filtert, verbergt het gedrag
   * van de matcher.
   */
  search(criteria: SearchCriteria, context: SourceSearchContext): Promise<SourceSearchResult> {
    const started = Date.now()
    const wanted = criteria.transactionType === 'rent' ? 'RENT' : 'BUY'

    let listings = this.listings.filter(
      (listing) => (listing.transactionType ?? 'BUY') === wanted,
    )

    if (criteria.postalCodes?.length) {
      listings = listings.filter(
        (l) => l.postalCode !== undefined && l.postalCode !== null && criteria.postalCodes!.includes(l.postalCode),
      )
    } else if (criteria.locations?.length) {
      const wantedCities = criteria.locations.map((l) => l.toLowerCase())
      listings = listings.filter((l) =>
        wantedCities.some((city) => (l.city ?? '').toLowerCase().includes(city)),
      )
    }

    const limited = listings.slice(0, context.maxResults)

    return Promise.resolve({
      listings: limited,
      stats: {
        fetched: limited.length,
        durationMs: Date.now() - started,
      },
    })
  }
}

export { FIXTURES }
