/**
 * Het contract voor een vastgoedbron.
 *
 * ─── WAT EEN BRON MAG ────────────────────────────────────────────────────────
 *   - officiële API's van vastgoedpartijen;
 *   - feeds en sitemaps die daarvoor bedoeld zijn;
 *   - makelaars die hun aanbod aanleveren;
 *   - handmatig ingevoerde panden.
 *
 * ─── WAT EEN BRON NIET MAG ───────────────────────────────────────────────────
 * Geen CAPTCHA-omzeiling, geen stealth-scraping, geen fingerprint-spoofing,
 * geen proxy-rotatie. Elke implementatie identificeert zich met een eerlijke
 * user-agent (`PROPERTY_SOURCE_USER_AGENT`), respecteert robots.txt en houdt
 * zich aan `PROPERTY_SOURCE_REQUESTS_PER_MINUTE`.
 *
 * Dit is geen juridische slag om de arm maar een ontwerpkeuze: een platform dat
 * gebruikers door een aankoop van honderdduizenden euro's begeleidt, kan niet
 * draaien op een databron die morgen wegvalt omdat hij tegen de voorwaarden in
 * werd verzameld.
 */
import type { SearchCriteria } from '@/modules/search/schemas/searchCriteria'

/**
 * Een pand zoals een bron het aanlevert, vóór normalisatie.
 *
 * De numerieke velden staan bewust als `number | string`. Dat is geen slordige
 * typering maar een eerlijke: bronnen leveren "€ 450.000", "3 slaapkamers" en
 * "150 m²" aan, en een type dat `number` belooft zou liegen over wat er
 * werkelijk binnenkomt. Het opschonen gebeurt op één plek —
 * `normalizeListing()` in src/modules/property/domain/normalize.ts — en alles
 * daarna werkt met `NormalizedProperty`, waar de types wél hard zijn.
 */
export type RawNumeric = number | string | null | undefined

export interface RawPropertyListing {
  externalId: string
  url: string
  title: string
  description?: string | null

  address?: string | null
  postalCode?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null

  propertyType?: string | null
  transactionType?: 'BUY' | 'RENT'

  /** Wordt genormaliseerd naar hele euro's. */
  price?: RawNumeric
  bedrooms?: RawNumeric
  bathrooms?: RawNumeric
  livingAreaM2?: RawNumeric
  landAreaM2?: RawNumeric
  epcLabel?: string | null
  epcValue?: RawNumeric
  buildYear?: RawNumeric
  features?: string[]
  imageUrl?: string | null

  publishedAt?: Date | null
}

export interface SourceSearchContext {
  /** Bovengrens per run. Voorkomt dat één zoekopdracht een bron leegtrekt. */
  maxResults: number
  userAgent: string
  timeoutMs: number
  /** Verzoeken per minuut die deze run mag doen. */
  requestsPerMinute: number
}

export interface SourceSearchResult {
  listings: RawPropertyListing[]
  /** Voor SearchRun.sourceStats: wat ging er goed of mis? */
  stats: {
    fetched: number
    durationMs: number
    blocked?: boolean
    error?: string
  }
}

export interface PropertySource {
  readonly name: string

  search(criteria: SearchCriteria, context: SourceSearchContext): Promise<SourceSearchResult>
}
