/**
 * Het contract waaraan elke bron voldoet.
 *
 * Bewust klein. Een collector doet één ding: advertenties ophalen en als
 * `RawListing` teruggeven. Hij normaliseert niet, classificeert niet, praat
 * niet met de database en beslist niet of iets een lead is. Al die stappen zijn
 * gedeeld en gelden voor elke bron; zou een collector ze zelf doen, dan zou
 * elke nieuwe bron ze opnieuw (en net iets anders) implementeren.
 *
 * Zie docs/ADDING-A-SOURCE.md voor het volledige recept.
 */
import type { RawListing } from '@/domain/types'
import type { Logger } from '@/lib/logger'

import type { HttpClient } from './base/httpClient'

/**
 * Hoe de bron benaderd wordt. Deze volgorde is de voorkeursvolgorde uit de
 * architectuur — een collector die `PUBLIC_HTML` declareert moet kunnen
 * uitleggen waarom de drie nettere routes niet konden.
 */
export type AccessMethod =
  | 'OFFICIAL_API'
  | 'PUBLIC_FEED'
  | 'STRUCTURED_DATA'
  | 'PUBLIC_HTML'
  | 'FIXTURE'
  | 'SYNTHETIC'

export interface CollectorContext {
  /** De enige weg naar buiten: robots, rate limiting, timeouts en retries zitten erin. */
  http: HttpClient
  logger: Logger
  /**
   * Wanneer deze bron voor het laatst met succes draaide. Collectors die een
   * gesorteerde feed lezen kunnen hiermee stoppen zodra ze bij bekend werk
   * komen, in plaats van elke keer de hele lijst te doorlopen.
   */
  lastSuccessAt: Date | null
  /** Bovengrens op het aantal advertenties per run; beschermt tegen een bron die opeens alles teruggeeft. */
  maxItems: number
  /** Wordt afgebroken zodra de run zijn totale tijdslimiet overschrijdt. */
  signal: AbortSignal
}

export interface CollectorResult {
  listings: RawListing[]
  /**
   * Niet-fatale problemen: drie van de honderd advertenties waren onparseerbaar.
   * De run wordt dan PARTIAL in plaats van SUCCESS, en het dashboard toont het.
   */
  warnings: string[]
}

export interface CollectorDefinition {
  /** Stabiele sleutel, gelijk aan `Source.key`. */
  key: string
  name: string
  accessMethod: AccessMethod
  baseUrl: string | null
  /** Standaardinterval; het dashboard mag dit per bron overschrijven. */
  defaultPollIntervalSeconds: number
  defaultRateLimitPerMinute: number
  /**
   * Waarom deze bron op deze manier benaderd mag worden. Verplicht: een bron
   * zonder verantwoording hoort niet in productie. Zichtbaar in het dashboard.
   */
  accessNotes: string
  /**
   * Heeft deze collector een echte browser nodig? Voor de MVP staat er geen
   * enkele op `true` — zie docs/ADDING-A-SOURCE.md over wanneer dat wél mag.
   */
  requiresBrowser: boolean
  collect(context: CollectorContext): Promise<CollectorResult>
}
