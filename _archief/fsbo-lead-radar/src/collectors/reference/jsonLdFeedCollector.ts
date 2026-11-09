/**
 * Referentiecollector: een echte bron via sitemap + JSON-LD.
 *
 * ─── WAAROM DEZE COLLECTOR STANDAARD UIT STAAT ───────────────────────────────
 *
 * Dit is werkende code, geen schets: geef hem een host die het toestaat en hij
 * haalt advertenties op. Maar hij staat uit, en hij weigert te draaien voor een
 * host die niet expliciet in `FEED_COLLECTOR_HOSTS` staat.
 *
 * De reden is dat robots.txt maar de helft van de vraag beantwoordt. Het zegt
 * wat een crawler technisch mag ophalen; het zegt niets over wat de
 * gebruiksvoorwaarden van die site toestaan met de opgehaalde gegevens, en al
 * helemaal niets over het doorverkopen van contactgegevens van particulieren.
 * Die afweging kan software niet maken. Door een expliciete allowlist te eisen
 * is het aanzetten van een bron altijd een bewuste beslissing van een mens,
 * nooit een verstopte default van dit bestand.
 *
 * ─── HOE HIJ WERKT ───────────────────────────────────────────────────────────
 *
 *   1. robots.txt lezen → welke sitemaps wijst de host aan? (via HttpClient)
 *   2. Sitemap ophalen → welke advertentie-URL's zijn recent gewijzigd?
 *   3. Per URL de JSON-LD lezen → gestructureerde advertentiedata.
 *
 * Stap 1 en 2 zijn precies waarvoor sitemaps bedoeld zijn: de host vertelt zelf
 * welke pagina's er zijn en wanneer ze wijzigden. Stap 3 leest schema.org-data
 * die de site publiceert opdat machines haar lezen. Nergens wordt iets omzeild;
 * elke request loopt door de robots-controle van de HttpClient.
 *
 * Zie docs/ADDING-A-SOURCE.md voor wat er nodig is om een echte bron te
 * activeren, inclusief de vragen die eerst beantwoord moeten zijn.
 */
import * as cheerio from 'cheerio'

import type { RawListing } from '@/domain/types'
import { ConfigError } from '@/lib/errors'

import { extractJsonLdBlocks, flattenJsonLd, hasType, readDate, readNumber, readString } from '../base/jsonld'
import type { CollectorContext, CollectorDefinition, CollectorResult } from '../types'

/**
 * De allowlist. Leeg in de repository: er is geen host waarvoor deze
 * beoordeling voor jou gemaakt kan worden.
 *
 * Zet er een host in wanneer je (a) hun robots.txt hebt gelezen, (b) hun
 * gebruiksvoorwaarden hebt gelezen en (c) hebt vastgesteld dat het doorsturen
 * van deze gegevens naar makelaars toegestaan is.
 */
export const FEED_COLLECTOR_HOSTS: readonly string[] = []

/** Hoe ver terug in de sitemap we kijken. */
const MAX_SITEMAP_AGE_HOURS = 24

interface SitemapEntry {
  url: string
  lastModified: Date | null
}

/**
 * Leest een sitemap of sitemap-index.
 *
 * Cheerio in XML-modus in plaats van een losse XML-parser: de dependency is er
 * al voor het HTML-werk, en sitemaps zijn eenvoudig genoeg dat een DOM-query
 * volstaat.
 */
export function parseSitemap(xml: string): { entries: SitemapEntry[]; indexes: string[] } {
  const $ = cheerio.load(xml, { xml: true })

  const indexes = $('sitemapindex > sitemap > loc')
    .map((_, element) => $(element).text().trim())
    .get()
    .filter((url) => url.length > 0)

  const entries: SitemapEntry[] = $('urlset > url')
    .map((_, element) => {
      const node = $(element)
      const url = node.find('loc').first().text().trim()
      const lastModifiedRaw = node.find('lastmod').first().text().trim()
      const lastModified = lastModifiedRaw ? new Date(lastModifiedRaw) : null

      return {
        url,
        lastModified: lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : null,
      }
    })
    .get()
    .filter((entry: SitemapEntry) => entry.url.length > 0)

  return { entries, indexes }
}

/**
 * Zet één schema.org-entiteit om in een `RawListing`.
 *
 * Losstaand geëxporteerd omdat dit het deel is dat per bron kan verschillen en
 * dus met een fixture getest moet kunnen worden zonder netwerk.
 */
export function mapJsonLdListing(
  entity: Record<string, unknown>,
  options: { source: string; url: string; scrapedAt: Date },
): RawListing | null {
  const about = (entity.about ?? entity.mainEntity ?? {}) as Record<string, unknown>
  const offers = (entity.offers ?? {}) as Record<string, unknown>
  const seller = (entity.seller ?? entity.provider ?? offers.seller ?? {}) as Record<string, unknown>

  const identifier =
    readString(entity, 'identifier') ??
    readString(entity, 'sku') ??
    readString(entity, 'url') ??
    options.url

  const url = readString(entity, 'url') ?? options.url
  if (!identifier || !url) return null

  // Verkoop of verhuur, uit `businessFunction` van goodrelations. LeaseOut is
  // de term voor verhuren; alles anders behandelen we als verkoop en laten we
  // door de normalisatie nachecken op de tekst.
  const businessFunction = readString(offers, 'businessFunction') ?? ''
  const listingType = /lease|rent/i.test(businessFunction) ? 'rent' : undefined

  const address = (about.address ?? entity.address ?? {}) as Record<string, unknown>

  const sellerTypeRaw = readString(seller, '@type') ?? ''
  const sellerTypeHint: RawListing['sellerTypeHint'] =
    sellerTypeRaw.toLowerCase() === 'person'
      ? 'private'
      : /organization|corporation|realestateagent|localbusiness/i.test(sellerTypeRaw)
        ? 'professional'
        : 'unknown'

  return {
    source: options.source,
    sourceListingId: identifier,
    url,
    title: readString(entity, 'name'),
    description: readString(entity, 'description'),
    price: readNumber(offers, 'price'),
    currency: readString(offers, 'priceCurrency') ?? 'EUR',
    listingType,
    propertyType: readString(about, '@type') ?? readString(entity, 'category'),
    postalCode: readString(address, 'postalCode'),
    city: readString(address, 'addressLocality'),
    address: readString(address, 'streetAddress'),
    bedrooms: readNumber(about, 'numberOfBedrooms') ?? readNumber(about, 'numberOfRooms'),
    surfaceArea: readNumber(about, 'floorSize', 'value'),
    sellerName: readString(seller, 'name'),
    sellerPhone: readString(seller, 'telephone'),
    sellerTypeHint,
    sellerProfileUrl: readString(seller, 'url'),
    publishedAt: readDate(entity, 'datePosted') ?? readDate(entity, 'datePublished'),
    scrapedAt: options.scrapedAt,
    raw: entity,
  }
}

/** Alle vastgoedadvertenties uit één HTML-pagina. */
export function extractListingsFromHtml(
  html: string,
  options: { source: string; url: string; scrapedAt: Date },
): RawListing[] {
  const entities = flattenJsonLd(extractJsonLdBlocks(html))

  return entities
    .filter((entity) =>
      hasType(entity, 'RealEstateListing', 'Residence', 'SingleFamilyResidence', 'Apartment', 'House', 'Product', 'Offer'),
    )
    .map((entity) => mapJsonLdListing(entity, options))
    .filter((listing): listing is RawListing => listing !== null)
}

export const JSONLD_FEED_SOURCE_KEY = 'jsonld-feed'

export const jsonLdFeedCollector: CollectorDefinition = {
  key: JSONLD_FEED_SOURCE_KEY,
  name: 'Referentie: sitemap + JSON-LD',
  accessMethod: 'STRUCTURED_DATA',
  baseUrl: null,
  defaultPollIntervalSeconds: 900,
  defaultRateLimitPerMinute: 10,
  accessNotes:
    'Staat standaard uit en weigert te draaien zonder host in FEED_COLLECTOR_HOSTS. Leest uitsluitend sitemaps die robots.txt zelf aanwijst en schema.org-data die de site publiceert. Voeg pas een host toe na het lezen van robots.txt én de gebruiksvoorwaarden.',
  requiresBrowser: false,

  async collect(context: CollectorContext): Promise<CollectorResult> {
    if (FEED_COLLECTOR_HOSTS.length === 0) {
      throw new ConfigError(
        'De referentiecollector heeft geen toegestane host. Zie docs/ADDING-A-SOURCE.md; ' +
          'vul FEED_COLLECTOR_HOSTS pas in na het lezen van robots.txt en de gebruiksvoorwaarden van de bron.',
      )
    }

    const now = new Date()
    const cutoff = new Date(
      Math.max(
        now.getTime() - MAX_SITEMAP_AGE_HOURS * 3_600_000,
        context.lastSuccessAt?.getTime() ?? 0,
      ),
    )

    const listings: RawListing[] = []
    const warnings: string[] = []

    for (const host of FEED_COLLECTOR_HOSTS) {
      const origin = `https://${host}`

      // De host wijst zelf zijn sitemaps aan in robots.txt. Dat is het nette
      // startpunt: geen URL's raden, geen zoekpagina's afgaan.
      const sitemaps = await context.http.sitemapsFor(origin)
      if (sitemaps.length === 0) {
        warnings.push(`${host}: robots.txt wijst geen sitemap aan`)
        continue
      }

      for (const sitemapUrl of sitemaps.slice(0, 3)) {
        if (context.signal.aborted) break

        const response = await context.http.get(sitemapUrl, { signal: context.signal })
        const { entries, indexes } = parseSitemap(response.body)

        // Een sitemap-index verwijst door naar echte sitemaps; één niveau diep
        // volgen is genoeg voor de gangbare opzet.
        const targets = [...entries]
        for (const indexUrl of indexes.slice(0, 3)) {
          if (context.signal.aborted) break
          const nested = await context.http.get(indexUrl, { signal: context.signal })
          targets.push(...parseSitemap(nested.body).entries)
        }

        const recent = targets
          .filter((entry) => entry.lastModified === null || entry.lastModified >= cutoff)
          .slice(0, context.maxItems)

        for (const entry of recent) {
          if (context.signal.aborted) break
          if (listings.length >= context.maxItems) break

          try {
            const page = await context.http.get(entry.url, { signal: context.signal })
            const found = extractListingsFromHtml(page.body, {
              source: JSONLD_FEED_SOURCE_KEY,
              url: entry.url,
              scrapedAt: now,
            })

            if (found.length === 0) {
              warnings.push(`${entry.url}: geen JSON-LD-advertentie gevonden`)
            }
            listings.push(...found)
          } catch (error) {
            // Eén onbereikbare pagina mag de run niet stoppen; de bron als
            // geheel is nog gezond.
            warnings.push(
              `${entry.url}: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        }
      }
    }

    return { listings: listings.slice(0, context.maxItems), warnings }
  },
}
