/**
 * De fixture-bron én de `PropertySource`-abstractie.
 *
 * Als de fixture door het contract past, past een echte API er ook doorheen —
 * dat is waarvoor deze bron bestaat.
 */
import { describe, expect, it } from 'vitest'

import { FixturePropertySource, FIXTURES } from '@/server/integrations/property/fixtureSource'
import { normalizeListing } from '@/modules/property/domain/normalize'
import { matchProperty } from '@/modules/property/domain/matching'
import { searchCriteriaSchema } from '@/modules/search/schemas/searchCriteria'

const source = new FixturePropertySource()

const context = {
  maxResults: 100,
  userAgent: 'test',
  timeoutMs: 1000,
  requestsPerMinute: 60,
}

const criteria = (input: Record<string, unknown> = {}) => searchCriteriaSchema.parse(input)

describe('de bron levert bruikbare listings', () => {
  it('geeft resultaten zonder filters', async () => {
    const result = await source.search(criteria(), context)
    expect(result.listings.length).toBeGreaterThan(0)
  })

  it('rapporteert wat hij ophaalde', async () => {
    const result = await source.search(criteria(), context)
    expect(result.stats.fetched).toBe(result.listings.length)
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('respecteert maxResults', async () => {
    const result = await source.search(criteria(), { ...context, maxResults: 2 })
    expect(result.listings.length).toBeLessThanOrEqual(2)
  })

  it('filtert op postcode', async () => {
    const result = await source.search(criteria({ postalCodes: ['9000'] }), context)
    expect(result.listings.every((l) => l.postalCode === '9000')).toBe(true)
  })

  it('filtert op gemeente', async () => {
    const result = await source.search(criteria({ locations: ['Leuven'] }), context)
    expect(result.listings.every((l) => l.city === 'Leuven')).toBe(true)
  })

  it('geeft geen huurpanden bij een koopzoekopdracht', async () => {
    const result = await source.search(criteria({ transactionType: 'rent' }), context)
    expect(result.listings).toHaveLength(0)
  })
})

describe('elke fixture normaliseert schoon', () => {
  it('levert geldige genormaliseerde panden op', () => {
    for (const listing of FIXTURES) {
      const normalized = normalizeListing('fixture', listing)

      expect(normalized.externalId, listing.externalId).toBeTruthy()
      expect(normalized.urlNormalized).toMatch(/^https:\/\//)
      expect(normalized.fingerprint).toHaveLength(64)
      expect(normalized.price).toBeGreaterThan(0)
    }
  })

  it('geeft elke fixture een unieke sleutel en URL', () => {
    const ids = FIXTURES.map((f) => f.externalId)
    const urls = FIXTURES.map((f) => normalizeListing('fixture', f).urlNormalized)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('is verzonnen data en verwijst naar example.com', () => {
    // Zelfde principe als bij de financieringsseed: geen echte data in code.
    for (const listing of FIXTURES) {
      expect(listing.url).toContain('example.com')
    }
  })
})

describe('de keten van bron tot match', () => {
  it('vindt een woning die aan de criteria voldoet', async () => {
    const wanted = criteria({
      locations: ['Gent'],
      hardRequirements: { maxPrice: 450_000, minBedrooms: 3 },
    })

    const result = await source.search(wanted, context)
    const matches = result.listings
      .map((listing) => matchProperty(toMatchable(listing), wanted))
      .filter((m) => m.hardPass)

    expect(matches.length).toBeGreaterThan(0)
  })

  it('laat een te dure woning niet slagen op de harde eis', async () => {
    const wanted = criteria({ hardRequirements: { maxPrice: 100_000 } })

    const result = await source.search(wanted, context)
    const passing = result.listings.filter((l) => matchProperty(toMatchable(l), wanted).hardPass)

    expect(passing).toHaveLength(0)
  })

  it('geeft een hogere score naarmate meer voorkeuren gehaald worden', async () => {
    const result = await source.search(criteria({ locations: ['Gent'] }), context)
    const listing = result.listings[0]!

    const strikt = matchProperty(
      toMatchable(listing),
      criteria({ preferences: { minBedrooms: 20, epcLabels: ['A++'] } }),
    )
    const soepel = matchProperty(
      toMatchable(listing),
      criteria({ preferences: { minBedrooms: 1 } }),
    )

    expect(soepel.score).toBeGreaterThan(strikt.score)
  })
})

/** Zet een ruwe listing om in wat de matcher verwacht. */
function toMatchable(listing: (typeof FIXTURES)[number]) {
  const normalized = normalizeListing('fixture', listing)
  return {
    title: normalized.title,
    description: normalized.description,
    city: normalized.city,
    postalCode: normalized.postalCode,
    propertyType: normalized.propertyType,
    price: normalized.price,
    bedrooms: normalized.bedrooms,
    bathrooms: normalized.bathrooms,
    livingAreaM2: normalized.livingAreaM2,
    landAreaM2: normalized.landAreaM2,
    epcLabel: normalized.epcLabel,
    features: normalized.features,
  }
}
