import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { extractJsonLdBlocks, flattenJsonLd, hasType, readNumber, readString } from '@/collectors/base/jsonld'
import { evaluate, parseRobotsTxt } from '@/collectors/base/robots'
import { generateDemoListings } from '@/collectors/demo/demoMarketCollector'
import { fixtureCollector, mapFixtureListing } from '@/collectors/fixture/fixtureCollector'
import {
  extractListingsFromHtml,
  parseSitemap,
} from '@/collectors/reference/jsonLdFeedCollector'
import { allCollectors, getCollector } from '@/collectors/registry'
import type { CollectorContext } from '@/collectors/types'
import { normalizeListing } from '@/domain/normalization'
import { createLogger } from '@/lib/logger'

/**
 * Alle tests hier draaien op lokale bestanden. Er wordt in deze suite geen
 * enkele externe site benaderd — dat is niet alleen netjes, het is ook de enige
 * manier om tests te hebben die morgen nog hetzelfde doen.
 */

function context(overrides: Partial<CollectorContext> = {}): CollectorContext {
  return {
    // De fixture-collector raakt de HttpClient niet aan; hem hier weglaten
    // maakt zichtbaar dat de test geen netwerk gebruikt.
    http: null as unknown as CollectorContext['http'],
    logger: createLogger({ component: 'test' }),
    lastSuccessAt: null,
    maxItems: 100,
    signal: new AbortController().signal,
    ...overrides,
  }
}

describe('registry', () => {
  it('kent elke collector onder zijn eigen sleutel', () => {
    for (const collector of allCollectors()) {
      expect(getCollector(collector.key)).toBe(collector)
    }
  })

  it('geeft null voor een onbekende sleutel', () => {
    expect(getCollector('bestaat-niet')).toBeNull()
  })

  it('eist van elke collector een verantwoording van de toegang', () => {
    // Een bron zonder uitleg waarom hij opgehaald mag worden hoort er niet te
    // zijn; het dashboard toont dit veld aan de beheerder.
    for (const collector of allCollectors()) {
      expect(collector.accessNotes.length).toBeGreaterThan(20)
    }
  })

  it('gebruikt in de MVP geen enkele browser', () => {
    for (const collector of allCollectors()) {
      expect(collector.requiresBrowser).toBe(false)
    }
  })
})

describe('fixtureCollector', () => {
  it('leest de fixtures en levert bruikbare advertenties', async () => {
    const result = await fixtureCollector.collect(context())

    expect(result.listings.length).toBeGreaterThanOrEqual(10)
    expect(result.warnings).toHaveLength(0)

    for (const listing of result.listings) {
      expect(listing.source).toBe('fixture-be')
      expect(listing.sourceListingId).not.toBe('')
      expect(listing.url).toMatch(/^https?:\/\//)
    }
  })

  it('levert advertenties die de normalisatie doorstaan', async () => {
    const result = await fixtureCollector.collect(context())
    for (const listing of result.listings) {
      expect(() => normalizeListing(listing)).not.toThrow()
    }
  })

  it('respecteert maxItems', async () => {
    const result = await fixtureCollector.collect(context({ maxItems: 3 }))
    expect(result.listings).toHaveLength(3)
  })

  it('zet de Belgische prijsnotatie uit de fixture goed om', () => {
    const listing = mapFixtureListing(
      { id: 'x', url: 'https://example.be/x', price: '€ 329.000' },
      'fixture-be',
      new Date(),
    )
    expect(listing.price).toBe(329_000)
  })

  it('rekent publishedMinutesAgo om naar een absoluut moment', () => {
    const now = new Date('2026-08-16T12:00:00Z')
    const listing = mapFixtureListing(
      { id: 'x', url: 'https://example.be/x', publishedMinutesAgo: 15 },
      'fixture-be',
      now,
    )
    expect(listing.publishedAt?.toISOString()).toBe('2026-08-16T11:45:00.000Z')
  })
})

describe('demo-generator', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('is deterministisch bij dezelfde seed', () => {
    const first = generateDemoListings({ seed: 7, count: 5, now, sourceKey: 'demo-be' })
    const second = generateDemoListings({ seed: 7, count: 5, now, sourceKey: 'demo-be' })
    expect(first.map((item) => item.sourceListingId)).toEqual(
      second.map((item) => item.sourceListingId),
    )
    expect(first[0]?.title).toBe(second[0]?.title)
  })

  it('geeft andere advertenties bij een andere seed', () => {
    const first = generateDemoListings({ seed: 7, count: 5, now, sourceKey: 'demo-be' })
    const second = generateDemoListings({ seed: 8, count: 5, now, sourceKey: 'demo-be' })
    expect(first[0]?.sourceListingId).not.toBe(second[0]?.sourceListingId)
  })

  it('levert advertenties die de normalisatie doorstaan', () => {
    const listings = generateDemoListings({ seed: 3, count: 30, now, sourceKey: 'demo-be' })
    for (const listing of listings) {
      expect(() => normalizeListing(listing)).not.toThrow()
    }
  })

  it('geeft een geldige Belgische postcode aan elke advertentie', () => {
    const listings = generateDemoListings({ seed: 3, count: 20, now, sourceKey: 'demo-be' })
    for (const listing of listings) {
      expect(listing.postalCode).toMatch(/^[1-9]\d{3}$/)
    }
  })

  it('mengt particulieren en professionals', () => {
    const listings = generateDemoListings({ seed: 5, count: 40, now, sourceKey: 'demo-be' })
    const hints = new Set(listings.map((listing) => listing.sellerTypeHint))
    expect(hints.has('private')).toBe(true)
    expect(hints.has('professional')).toBe(true)
  })
})

describe('JSON-LD parsing', () => {
  it('haalt een advertentie uit een echte HTML-fixture', async () => {
    const html = await readFile(
      path.join(process.cwd(), 'fixtures', 'listing-jsonld.html'),
      'utf8',
    )

    const listings = extractListingsFromHtml(html, {
      source: 'jsonld-feed',
      url: 'https://fixtures.local/te-koop/9100/instapklare-woning-met-tuin',
      scrapedAt: new Date('2026-08-16T12:00:00Z'),
    })

    expect(listings).toHaveLength(1)
    const listing = listings[0]
    expect(listing?.sourceListingId).toBe('SNK-77120')
    expect(listing?.price).toBe(312_000)
    expect(listing?.postalCode).toBe('9100')
    expect(listing?.city).toBe('Sint-Niklaas')
    expect(listing?.bedrooms).toBe(3)
    expect(listing?.surfaceArea).toBe(132)
    expect(listing?.sellerName).toBe('Bart Willems')
    // `@type: Person` is het sterkste signaal dat de bron zelf geeft.
    expect(listing?.sellerTypeHint).toBe('private')
  })

  it('slaat kapotte JSON-LD over zonder de pagina te verliezen', async () => {
    // De fixture bevat met opzet een tweede, ongeldig blok.
    const html = await readFile(
      path.join(process.cwd(), 'fixtures', 'listing-jsonld.html'),
      'utf8',
    )
    expect(extractJsonLdBlocks(html)).toHaveLength(1)
  })

  it('vlakt @graph en itemListElement uit', () => {
    const blocks = [
      { '@graph': [{ '@type': 'Thing', name: 'a' }, { '@type': 'Thing', name: 'b' }] },
      { '@type': 'ItemList', itemListElement: [{ item: { '@type': 'Thing', name: 'c' } }] },
    ]
    const entities = flattenJsonLd(blocks)
    expect(entities.map((entity) => entity.name)).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    )
  })

  it('herkent een @type dat een array is', () => {
    expect(hasType({ '@type': ['Product', 'RealEstateListing'] }, 'realestatelisting')).toBe(true)
    expect(hasType({ '@type': 'Product' }, 'realestatelisting')).toBe(false)
  })

  it('leest waarden die als object verpakt zijn', () => {
    expect(readString({ name: { '@value': 'Woning' } }, 'name')).toBe('Woning')
    expect(readNumber({ offers: { price: '329000.00' } }, 'offers', 'price')).toBe(329_000)
    expect(readNumber({ offers: { price: '€ 329.000' } }, 'offers', 'price')).toBe(329_000)
  })
})

describe('sitemap parsing', () => {
  it('leest URL-vermeldingen met lastmod', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.be/a</loc><lastmod>2026-08-16T08:00:00+02:00</lastmod></url>
        <url><loc>https://example.be/b</loc></url>
      </urlset>`

    const { entries } = parseSitemap(xml)
    expect(entries).toHaveLength(2)
    expect(entries[0]?.url).toBe('https://example.be/a')
    expect(entries[0]?.lastModified).toBeInstanceOf(Date)
    expect(entries[1]?.lastModified).toBeNull()
  })

  it('leest een sitemap-index', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.be/sitemap-1.xml</loc></sitemap>
      </sitemapindex>`

    const { indexes, entries } = parseSitemap(xml)
    expect(indexes).toEqual(['https://example.be/sitemap-1.xml'])
    expect(entries).toHaveLength(0)
  })
})

describe('robots.txt', () => {
  const ROBOTS = `
User-agent: *
Disallow: /zoeken
Disallow: /*?filter=
Allow: /zoeken/publiek
Crawl-delay: 5

User-agent: FsboLeadRadarBot
Disallow: /prive

Sitemap: https://example.be/sitemap.xml
`

  it('leest sitemaps uit', () => {
    expect(parseRobotsTxt(ROBOTS).sitemaps).toEqual(['https://example.be/sitemap.xml'])
  })

  it('past de meest specifieke user-agent-groep toe', () => {
    const ruleset = parseRobotsTxt(ROBOTS)

    // Onze bot heeft een eigen groep; de regels van `*` gelden dan niet.
    expect(evaluate(ruleset, '/zoeken', 'FsboLeadRadarBot/0.1').allowed).toBe(true)
    expect(evaluate(ruleset, '/prive', 'FsboLeadRadarBot/0.1').allowed).toBe(false)

    // Een andere bot valt onder `*`.
    expect(evaluate(ruleset, '/zoeken', 'AndereBot').allowed).toBe(false)
  })

  it('laat de langste matchende regel winnen', () => {
    const ruleset = parseRobotsTxt(ROBOTS)
    expect(evaluate(ruleset, '/zoeken/publiek', 'AndereBot').allowed).toBe(true)
  })

  it('begrijpt jokers in paden', () => {
    const ruleset = parseRobotsTxt(ROBOTS)
    expect(evaluate(ruleset, '/aanbod?filter=prijs', 'AndereBot').allowed).toBe(false)
  })

  it('leest Crawl-delay', () => {
    const ruleset = parseRobotsTxt(ROBOTS)
    expect(evaluate(ruleset, '/', 'AndereBot').crawlDelaySeconds).toBe(5)
  })

  it('escapet regex-metatekens in paden', () => {
    // Zonder escaping zou "/a.b" ook op "/axb" matchen en te veel blokkeren.
    const ruleset = parseRobotsTxt('User-agent: *\nDisallow: /a.b')
    expect(evaluate(ruleset, '/a.b', 'Bot').allowed).toBe(false)
    expect(evaluate(ruleset, '/axb', 'Bot').allowed).toBe(true)
  })

  it('negeert een lege Disallow', () => {
    // "Disallow:" zonder pad betekent volgens de standaard: niets verboden.
    const ruleset = parseRobotsTxt('User-agent: *\nDisallow:')
    expect(evaluate(ruleset, '/wat-dan-ook', 'Bot').allowed).toBe(true)
  })

  it('staat alles toe wanneer er geen regels zijn', () => {
    expect(evaluate(parseRobotsTxt(''), '/', 'Bot').allowed).toBe(true)
  })
})
