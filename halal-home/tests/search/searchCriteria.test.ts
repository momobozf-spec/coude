import { describe, expect, it } from 'vitest'

import {
  CRITERIA_SCHEMA_VERSION,
  describeCriteria,
  emptyCriteria,
  hasAnyCriterion,
  searchCriteriaSchema,
} from '@/modules/search/schemas/searchCriteria'

describe('lege criteria', () => {
  it('is een geldig startpunt', () => {
    const empty = emptyCriteria()
    expect(empty.transactionType).toBe('buy')
    expect(empty.hardRequirements).toEqual({})
    expect(empty.preferences).toEqual({})
  })

  it('bevat geen bruikbaar criterium', () => {
    expect(hasAnyCriterion(emptyCriteria())).toBe(false)
  })

  it('heeft een versienummer voor migraties van opgeslagen documenten', () => {
    expect(CRITERIA_SCHEMA_VERSION).toBeGreaterThan(0)
  })
})

describe('validatie', () => {
  it('accepteert een realistische zoekopdracht', () => {
    // "Huis rond Leuven onder €500.000, minstens 3 slaapkamers, liefst EPC A of B
    // en dichtbij een moskee."
    const parsed = searchCriteriaSchema.parse({
      transactionType: 'buy',
      locations: ['Leuven'],
      radiusKm: 15,
      hardRequirements: {
        propertyTypes: ['house'],
        maxPrice: 500_000,
        minBedrooms: 3,
        nearby: [{ category: 'mosque', maxDistanceMeters: 2000 }],
      },
      preferences: {
        epcLabels: ['A++', 'A+', 'A', 'B'],
        features: ['garden'],
      },
    })

    expect(parsed.hardRequirements.maxPrice).toBe(500_000)
    expect(parsed.preferences.epcLabels).toContain('B')
    expect(hasAnyCriterion(parsed)).toBe(true)
  })

  it('weigert een onbekend veld', () => {
    // `.strict()`: zo valt het meteen op wanneer het model een veld verzint.
    expect(() =>
      searchCriteriaSchema.parse({ hardRequirements: { zwembadVerplicht: true } }),
    ).toThrow()
  })

  it('weigert een minimumprijs boven de maximumprijs', () => {
    expect(() =>
      searchCriteriaSchema.parse({
        hardRequirements: { minPrice: 500_000, maxPrice: 300_000 },
      }),
    ).toThrow()
  })

  it('weigert een straal zonder locatie', () => {
    expect(() => searchCriteriaSchema.parse({ radiusKm: 10 })).toThrow()
  })

  it('accepteert een straal mét locatie', () => {
    expect(() =>
      searchCriteriaSchema.parse({ radiusKm: 10, locations: ['Gent'] }),
    ).not.toThrow()
  })

  it('weigert een postcode die geen vier cijfers is', () => {
    expect(() => searchCriteriaSchema.parse({ postalCodes: ['90000'] })).toThrow()
    expect(() => searchCriteriaSchema.parse({ postalCodes: ['9OOO'] })).toThrow()
    expect(() => searchCriteriaSchema.parse({ postalCodes: ['9000'] })).not.toThrow()
  })

  it('weigert een onbekend EPC-label', () => {
    expect(() =>
      searchCriteriaSchema.parse({ hardRequirements: { epcLabels: ['AAA'] } }),
    ).toThrow()
  })

  it('geeft een buurtvoorziening een standaardafstand', () => {
    const parsed = searchCriteriaSchema.parse({
      hardRequirements: { nearby: [{ category: 'mosque' }] },
    })
    expect(parsed.hardRequirements.nearby?.[0]?.maxDistanceMeters).toBe(2000)
  })

  it('weigert een onbekende voorziening', () => {
    expect(() =>
      searchCriteriaSchema.parse({ hardRequirements: { nearby: [{ category: 'casino' }] } }),
    ).toThrow()
  })

  it('weigert een absurde prijs', () => {
    expect(() =>
      searchCriteriaSchema.parse({ hardRequirements: { maxPrice: 99_000_000 } }),
    ).toThrow()
  })
})

describe('samenvatting', () => {
  it('beschrijft een zoekopdracht in gewone taal', () => {
    const criteria = searchCriteriaSchema.parse({
      locations: ['Gent'],
      hardRequirements: { maxPrice: 450_000, minBedrooms: 3 },
    })

    const description = describeCriteria(criteria)
    expect(description).toContain('Te koop')
    expect(description).toContain('Gent')
    expect(description).toContain('3 slaapkamers')
  })

  it('herkent huur', () => {
    const criteria = searchCriteriaSchema.parse({ transactionType: 'rent' })
    expect(describeCriteria(criteria)).toContain('Te huur')
  })
})

describe('bruikbaarheid van criteria', () => {
  it('herkent een locatie als bruikbaar criterium', () => {
    expect(hasAnyCriterion(searchCriteriaSchema.parse({ locations: ['Gent'] }))).toBe(true)
  })

  it('herkent een voorkeur als bruikbaar criterium', () => {
    expect(
      hasAnyCriterion(searchCriteriaSchema.parse({ preferences: { minBedrooms: 2 } })),
    ).toBe(true)
  })

  it('beschouwt lege arrays niet als criterium', () => {
    expect(
      hasAnyCriterion(searchCriteriaSchema.parse({ hardRequirements: { features: [] } })),
    ).toBe(false)
  })
})
