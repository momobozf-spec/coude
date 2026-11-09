/**
 * Het contract waar elke vastgoedbron aan voldoet.
 *
 * Bewust `PropertySource` en niet `PropertyScraper`: scraping is één manier om
 * aan advertenties te komen, en niet de manier waar we op willen leunen. Een
 * officiële API, een XML-feed, een sitemap, een partnerkoppeling of een
 * handmatig geïmporteerd bestand leveren dezelfde `PropertyListing[]` op en
 * passen zonder uitzondering in de rest van de pijplijn. `kind` maakt alleen
 * verschil voor logging, throttling en het al dan niet starten van een browser.
 *
 * De drie stappen zijn strikt gescheiden:
 *
 *   ophalen (`fetchRaw`) → normaliseren (`normalize`) → matchen/opslaan
 *
 * `fetchRaw` mag netwerk raken en falen. `normalize` is puur en synchroon, en
 * dus zonder netwerk te testen tegen opgeslagen snapshots. Matchen en opslaan
 * kennen geen enkele bron.
 */
import type { PropertyListing } from "../schemas/property.js";
import type { SearchCriteria } from "../schemas/searchCriteria.js";

export type SourceKind =
  /** Publieke website; robots.txt en rate limits gelden onverkort. */
  | "scrape"
  /** Officiële API met sleutel of token. */
  | "api"
  /** RSS/XML/JSON-feed die de aanbieder zelf publiceert. */
  | "feed"
  /** sitemap.xml — expliciet bedoeld om gelezen te worden. */
  | "sitemap"
  /** Partnerkoppeling onder contract. */
  | "partner"
  /** Handmatig geïmporteerde advertenties (CSV, plakwerk, e-mail). */
  | "manual"
  /** Lokale fixtures voor development en tests. */
  | "fixture";

export interface SourceLogger {
  debug(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export interface SourceSearchContext {
  /** Bovengrens op resultaten, zodat een brede zoekopdracht geen uur duurt. */
  readonly maxResults: number;
  /** Afgebroken zodra de run stopt of een timeout verstrijkt. */
  readonly signal: AbortSignal;
  readonly logger: SourceLogger;
}

/**
 * Wat een bron letterlijk oplevert vóór normalisatie. `payload` is `unknown`:
 * alleen de bron zelf weet wat de vorm is, en die kennis hoort daar te blijven.
 */
export interface RawListing {
  readonly source: string;
  readonly externalId: string;
  readonly url: string;
  readonly payload: unknown;
  readonly fetchedAt: Date;
}

export interface PropertySource {
  /** Stabiele sleutel; komt in `Property.source`, in de logs en in
   *  `SCRAPER_ENABLED_SOURCES`. */
  readonly name: string;
  readonly kind: SourceKind;
  /** Alleen `true` wanneer JavaScript-rendering echt nodig is. De registry
   *  start dan pas een browser. */
  readonly requiresBrowser: boolean;

  /**
   * Kan deze bron iets betekenen voor deze criteria? Een bron die enkel
   * Vlaanderen dekt geeft `false` voor een zoekopdracht in Luik. Dat scheelt
   * een nutteloze request én een misleidende "0 resultaten" in de logs.
   */
  supports(criteria: SearchCriteria): boolean;

  /**
   * Haalt op én normaliseert. Gooit `RobotsDisallowedError` of
   * `SourceBlockedError` in plaats van stilletjes leeg terug te keren: het
   * verschil tussen "niets gevonden" en "wij mogen hier niet zoeken" moet
   * zichtbaar blijven.
   */
  search(criteria: SearchCriteria, context: SourceSearchContext): Promise<PropertyListing[]>;
}
