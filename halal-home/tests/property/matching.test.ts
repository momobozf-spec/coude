import { describe, expect, it } from 'vitest'

import {
  matchFacts,
  matchProperty,
  type MatchableProperty,
} from '@/modules/property/domain/matching'
import {
  searchCriteriaSchema,
  type SearchCriteria,
} from '@/modules/search/schemas/searchCriteria'

const property = (overrides: Partial<MatchableProperty> = {}): MatchableProperty => ({
  title: 'Woning met tuin',
  description: 'Ruime woning met zuidgerichte tuin.',
  city: 'Gent',
  postalCode: '9000',
  propertyType: 'house',
  price: 400_000,
  bedrooms: 4,
  bathrooms: 1,
  livingAreaM2: 180,
  landAreaM2: 300,
  epcLabel: 'A',
  features: ['garden'],
  ...overrides,
})

const criteria = (input: Partial<SearchCriteria> = {}): SearchCriteria =>
  searchCriteriaSchema.parse(input)

describe('harde eisen', () => {
  it('slaagt wanneer alles klopt', () => {
    const result = matchProperty(
      property(),
      criteria({ hardRequirements: { maxPrice: 450_000, minBedrooms: 3 } }),
    )
    expect(result.hardPass).toBe(true)
  })

  it('faalt wanneer de prijs boven het maximum ligt', () => {
    const result = matchProperty(
      property({ price: 500_000 }),
      criteria({ hardRequirements: { maxPrice: 450_000 } }),
    )
    expect(result.hardPass).toBe(false)
  })

  it('faalt wanneer een uitgesloten trefwoord in de tekst staat', () => {
    // Aanwezigheid is hier wél hard: als er "te renoveren" staat, staat het er.
    const result = matchProperty(
      property({ description: 'Volledig te renoveren woning.' }),
      criteria({ hardRequirements: { excludedKeywords: ['te renoveren'] } }),
    )
    expect(result.hardPass).toBe(false)
  })

  it('faalt buiten het zoekgebied', () => {
    const result = matchProperty(
      property({ postalCode: '2000', city: 'Antwerpen' }),
      criteria({ postalCodes: ['9000', '9050'] }),
    )
    expect(result.hardPass).toBe(false)
  })
})

describe('onbekende gegevens', () => {
  it('laat een ontbrekend EPC de harde eis niet doen falen', () => {
    // Een ontbrekend label is geen bewijs dat het slecht is. Wegfilteren zou
    // betekenen dat de beste woningen met de slechtste advertentie verdwijnen.
    const result = matchProperty(
      property({ epcLabel: null }),
      criteria({ hardRequirements: { epcLabels: ['A', 'B'] } }),
    )

    expect(result.hardPass).toBe(true)
    expect(result.reasons.find((r) => r.field === 'epcLabels')?.verdict).toBe('unknown')
  })

  it('rapporteert onbekende velden zodat de gebruiker ze zelf kan nakijken', () => {
    const result = matchProperty(
      property({ epcLabel: null, bedrooms: null }),
      criteria({ hardRequirements: { epcLabels: ['A'], minBedrooms: 3 } }),
    )

    const facts = matchFacts(result)
    expect(facts.unknowns.length).toBeGreaterThanOrEqual(2)
    expect(facts.unknowns.join(' ')).toContain('EPC')
  })

  it('telt onbekende velden niet mee in de score', () => {
    // Anders wordt een woning gestraft voor wat de makelaar niet invulde.
    const compleet = matchProperty(
      property(),
      criteria({ preferences: { minBedrooms: 3 } }),
    )
    const metOnbekend = matchProperty(
      property({ epcLabel: null }),
      criteria({ preferences: { minBedrooms: 3, epcLabels: ['A'] } }),
    )

    expect(metOnbekend.score).toBe(compleet.score)
  })
})

describe('EPC-rangschikking', () => {
  it('accepteert een beter label dan gevraagd', () => {
    // "EPC A of B" moet ook A+ en A++ toelaten: de volgorde ís de betekenis.
    const result = matchProperty(
      property({ epcLabel: 'A+' }),
      criteria({ hardRequirements: { epcLabels: ['A', 'B'] } }),
    )
    expect(result.reasons.find((r) => r.field === 'epcLabels')?.verdict).toBe('pass')
  })

  it('weigert een slechter label', () => {
    const result = matchProperty(
      property({ epcLabel: 'D' }),
      criteria({ hardRequirements: { epcLabels: ['A', 'B'] } }),
    )
    expect(result.reasons.find((r) => r.field === 'epcLabels')?.verdict).toBe('fail')
  })
})

describe('score', () => {
  it('is 100 wanneer er niets beoordeelbaars is', () => {
    const result = matchProperty(property(), criteria())
    expect(result.score).toBe(100)
  })

  it('is lager naarmate meer voorkeuren falen', () => {
    const goed = matchProperty(
      property(),
      criteria({ preferences: { minBedrooms: 3, maxPrice: 450_000 } }),
    )
    const matig = matchProperty(
      property({ bedrooms: 2 }),
      criteria({ preferences: { minBedrooms: 3, maxPrice: 450_000 } }),
    )

    expect(matig.score).toBeLessThan(goed.score)
  })

  it('blijft tussen 0 en 100', () => {
    const result = matchProperty(
      property({ price: 900_000, bedrooms: 1, epcLabel: 'G' }),
      criteria({
        preferences: { maxPrice: 300_000, minBedrooms: 4, epcLabels: ['A'] },
      }),
    )
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('meldt woningen die op een voorkeur falen nog steeds', () => {
    // Voorkeuren verlagen de score maar blokkeren niet.
    const result = matchProperty(
      property({ price: 500_000 }),
      criteria({ preferences: { maxPrice: 400_000 } }),
    )
    expect(result.hardPass).toBe(true)
    expect(result.score).toBeLessThan(100)
  })
})

describe('buurtvoorzieningen als criterium', () => {
  it('slaagt wanneer de moskee binnen de gevraagde afstand ligt', () => {
    const result = matchProperty(
      property({ nearbyDistances: { mosque: 1400 } }),
      criteria({
        hardRequirements: { nearby: [{ category: 'mosque', maxDistanceMeters: 2000 }] },
      }),
    )
    expect(result.hardPass).toBe(true)
  })

  it('faalt wanneer de moskee te ver ligt', () => {
    const result = matchProperty(
      property({ nearbyDistances: { mosque: 4200 } }),
      criteria({
        hardRequirements: { nearby: [{ category: 'mosque', maxDistanceMeters: 2000 }] },
      }),
    )
    expect(result.hardPass).toBe(false)
  })

  it('blokkeert niet wanneer de afstand nog niet berekend is', () => {
    const result = matchProperty(
      property(),
      criteria({
        hardRequirements: { nearby: [{ category: 'mosque', maxDistanceMeters: 2000 }] },
      }),
    )
    expect(result.hardPass).toBe(true)
    expect(result.reasons.find((r) => r.field === 'nearby')?.verdict).toBe('unknown')
  })
})

describe('feiten voor de AI-samenvatting', () => {
  it('splitst de redenen in pluspunten, aandachtspunten en onbekend', () => {
    // De AI krijgt uitsluitend deze feiten. Zo kan hij geen eigenschappen
    // verzinnen die niet in de advertentie staan.
    const result = matchProperty(
      property({ price: 380_000, epcLabel: null }),
      criteria({
        hardRequirements: { maxPrice: 450_000 },
        preferences: { minBedrooms: 5, epcLabels: ['A'] },
      }),
    )

    const facts = matchFacts(result)
    expect(facts.positives.length).toBeGreaterThan(0)
    expect(facts.concerns.length).toBeGreaterThan(0)
    expect(facts.unknowns.length).toBeGreaterThan(0)

    // De som klopt met het totaal: geen enkele reden valt buiten de boot.
    expect(facts.positives.length + facts.concerns.length + facts.unknowns.length).toBe(
      result.reasons.length,
    )
  })
})
