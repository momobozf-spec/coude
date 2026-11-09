/**
 * Het register van vastgoedbronnen.
 *
 * Welke bronnen actief zijn staat in `PROPERTY_SOURCES` in de omgeving. Een bron
 * toevoegen is: een klasse schrijven die `PropertySource` implementeert, hem
 * hier registreren, en de naam in de env zetten. Geen enkele aanroeper verandert.
 *
 * ─── WAT EEN BRON MAG EN NIET MAG ────────────────────────────────────────────
 *
 * Zie de kop van src/types/propertySource.ts. Kort: officiële API's, feeds,
 * sitemaps en aangeleverd makelaarsaanbod zijn goed; CAPTCHA-omzeiling,
 * stealth-scraping, fingerprint-spoofing en proxy-rotatie niet.
 *
 * `buildSourceContext()` hieronder geeft elke bron de user-agent, time-out en
 * rate limit mee uit de configuratie. Een bron die die negeert, hoort niet in
 * dit register.
 */
import 'server-only'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import type { PropertySource, SourceSearchContext } from '@/types/propertySource'
import { FixturePropertySource } from './fixtureSource'

type SourceFactory = () => PropertySource

const REGISTRY: Record<string, SourceFactory> = {
  fixture: () => new FixturePropertySource(),
}

let cached: PropertySource[] | undefined

/**
 * De actieve bronnen.
 *
 * Een onbekende naam in `PROPERTY_SOURCES` wordt gelogd en overgeslagen, niet
 * gegooid: één typfout in de configuratie mag niet de hele zoekfunctie
 * uitschakelen. Blijft er niets over, dan valt hij terug op de fixture — beter
 * een voorspelbare set dan een lege pagina zonder uitleg.
 */
export function getPropertySources(): PropertySource[] {
  if (cached) return cached

  const sources: PropertySource[] = []

  for (const name of env.PROPERTY_SOURCES) {
    const factory = REGISTRY[name]
    if (!factory) {
      logger.warn('Onbekende vastgoedbron in PROPERTY_SOURCES, overgeslagen', { source: name })
      continue
    }
    sources.push(factory())
  }

  if (sources.length === 0) {
    logger.warn('Geen geldige vastgoedbronnen geconfigureerd, fixture gebruikt')
    sources.push(new FixturePropertySource())
  }

  cached = sources
  return cached
}

/** Alleen voor tests. */
export function setPropertySources(sources: PropertySource[] | undefined): void {
  cached = sources
}

/**
 * De uitvoeringscontext die elke bron meekrijgt.
 *
 * De limieten komen uit de configuratie en niet uit de aanroeper: zo kan geen
 * enkele codepad per ongeluk een bron harder aanspreken dan afgesproken.
 */
export function buildSourceContext(): SourceSearchContext {
  return {
    maxResults: env.PROPERTY_SOURCE_MAX_RESULTS_PER_RUN,
    userAgent: env.PROPERTY_SOURCE_USER_AGENT,
    timeoutMs: env.PROPERTY_SOURCE_TIMEOUT_MS,
    requestsPerMinute: env.PROPERTY_SOURCE_REQUESTS_PER_MINUTE,
  }
}

export { FixturePropertySource }
