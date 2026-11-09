/**
 * De fixture-collector: leest lokale bestanden, raakt nooit het netwerk.
 *
 * ─── WAAROM DEZE BRON EERSTEKLAS IS EN GEEN testhulpje ───────────────────────
 *
 * Hij maakt de hele pijplijn — normaliseren, classificeren, dedupliceren,
 * gebieden matchen, scoren, alerteren — draaibaar en testbaar zonder ook maar
 * één externe request. Dat is precies wat je wil terwijl je de moeilijke delen
 * bouwt, en het is de enige manier om de tests deterministisch te houden.
 *
 * De fixtures bevatten met opzet: particulieren, professionals, twijfelgevallen,
 * een Franstalige advertentie, en één advertentie die een duplicaat is van een
 * andere op een ander id (fx-1001 en fx-1007 zijn dezelfde woning). Zo doet elke
 * stap van de pijplijn in een demo-run echt iets.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { RawListing } from '@/domain/types'
import { ParseError } from '@/lib/errors'

import type { CollectorContext, CollectorDefinition, CollectorResult } from '../types'

interface FixtureSeller {
  name?: string
  phone?: string
  typeHint?: string
}

interface FixtureListing {
  id: string
  url: string
  title?: string
  description?: string
  price?: string | number
  type?: string
  propertyType?: string
  postalCode?: string
  city?: string
  address?: string
  bedrooms?: number
  surface?: number
  seller?: FixtureSeller
  /**
   * Relatief in plaats van absoluut, zodat de fixture niet veroudert. Een vaste
   * datum zou na een week elke advertentie "3 dagen oud" maken en de
   * versheidscomponent van de leadscore stilletjes uitschakelen.
   */
  publishedMinutesAgo?: number
}

const FIXTURE_PATH = path.join(process.cwd(), 'fixtures', 'listings.json')

/** Prijzen staan in de fixture zoals een bron ze schrijft: "€ 329.000". */
function parseFixturePrice(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value

  const cleaned = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseTypeHint(value: string | undefined): RawListing['sellerTypeHint'] {
  return value === 'private' || value === 'professional' ? value : 'unknown'
}

function parseListingType(value: string | undefined): RawListing['listingType'] {
  return value === 'sale' || value === 'rent' ? value : undefined
}

export function mapFixtureListing(
  item: FixtureListing,
  sourceKey: string,
  now: Date,
): RawListing {
  const publishedAt =
    item.publishedMinutesAgo === undefined
      ? undefined
      : new Date(now.getTime() - item.publishedMinutesAgo * 60_000)

  return {
    source: sourceKey,
    sourceListingId: item.id,
    url: item.url,
    title: item.title,
    description: item.description,
    price: parseFixturePrice(item.price),
    currency: 'EUR',
    listingType: parseListingType(item.type),
    propertyType: item.propertyType,
    postalCode: item.postalCode,
    city: item.city,
    address: item.address,
    bedrooms: item.bedrooms,
    surfaceArea: item.surface,
    sellerName: item.seller?.name,
    sellerPhone: item.seller?.phone,
    sellerTypeHint: parseTypeHint(item.seller?.typeHint),
    publishedAt,
    scrapedAt: now,
    raw: item,
  }
}

export const FIXTURE_SOURCE_KEY = 'fixture-be'

export const fixtureCollector: CollectorDefinition = {
  key: FIXTURE_SOURCE_KEY,
  name: 'Lokale fixtures (offline)',
  accessMethod: 'FIXTURE',
  baseUrl: null,
  defaultPollIntervalSeconds: 300,
  defaultRateLimitPerMinute: 60,
  accessNotes:
    'Leest uitsluitend fixtures/listings.json van de eigen schijf. Geen netwerkverkeer, geen externe partij, geen juridische vraag. Bedoeld voor demo, ontwikkeling en tests.',
  requiresBrowser: false,

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const now = new Date()
    const warnings: string[] = []

    let parsed: { listings?: unknown }
    try {
      parsed = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as { listings?: unknown }
    } catch (error) {
      throw new ParseError('fixtures/listings.json kon niet gelezen worden', {
        path: FIXTURE_PATH,
        cause: error instanceof Error ? error.message : String(error),
      })
    }

    if (!Array.isArray(parsed.listings)) {
      throw new ParseError('fixtures/listings.json bevat geen "listings"-array')
    }

    const listings: RawListing[] = []

    for (const item of parsed.listings.slice(0, context.maxItems)) {
      const record = item as FixtureListing
      if (typeof record.id !== 'string' || typeof record.url !== 'string') {
        warnings.push(`Fixture zonder id of url overgeslagen: ${JSON.stringify(item).slice(0, 80)}`)
        continue
      }
      listings.push(mapFixtureListing(record, FIXTURE_SOURCE_KEY, now))
    }

    context.logger.debug('Fixtures gelezen', { count: listings.length })
    return { listings, warnings }
  },
}
