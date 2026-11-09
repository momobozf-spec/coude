import { describe, expect, it } from 'vitest'

import { parseQueryDeterministic, reconcile } from '@/modules/search/domain/parser'
import { searchCriteriaSchema } from '@/modules/search/schemas/searchCriteria'

const parse = (query: string) => parseQueryDeterministic(query).criteria

describe('het voorbeeld uit de opdracht', () => {
  const QUERY =
    'Ik zoek een huis rond Leuven onder €500.000, minstens 3 slaapkamers, liefst EPC A of B en dichtbij een moskee.'

  it('haalt de locatie eruit', () => {
    expect(parse(QUERY).locations).toContain('Leuven')
  })

  it('haalt de maximumprijs eruit als harde eis', () => {
    expect(parse(QUERY).hardRequirements.maxPrice).toBe(500_000)
  })

  it('haalt het aantal slaapkamers eruit', () => {
    expect(parse(QUERY).hardRequirements.minBedrooms).toBe(3)
  })

  it('zet het woningtype', () => {
    expect(parse(QUERY).hardRequirements.propertyTypes).toContain('house')
  })

  it('zet EPC als voorkeur, niet als harde eis', () => {
    // "liefst" maakt het een voorkeur. Dat verschil bepaalt of een woning
    // wegvalt of alleen lager scoort.
    const criteria = parse(QUERY)
    expect(criteria.preferences.epcLabels).toBeDefined()
    expect(criteria.hardRequirements.epcLabels).toBeUndefined()
  })

  it('breidt "EPC A of B" uit naar alle betere labels', () => {
    // De volgorde in EPC_LABELS ís de betekenis: wie B accepteert, accepteert
    // ook A++.
    expect(parse(QUERY).preferences.epcLabels).toEqual(['A++', 'A+', 'A', 'B'])
  })

  it('herkent de moskee als buurtvoorziening', () => {
    const nearby = [
      ...(parse(QUERY).hardRequirements.nearby ?? []),
      ...(parse(QUERY).preferences.nearby ?? []),
    ]
    expect(nearby.some((n) => n.category === 'mosque')).toBe(true)
  })

  it('levert altijd geldige criteria op', () => {
    expect(searchCriteriaSchema.safeParse(parse(QUERY)).success).toBe(true)
  })
})

describe('bedragen', () => {
  it('leest een bedrag met duizendtalpunten', () => {
    expect(parse('huis in Gent onder €450.000').hardRequirements.maxPrice).toBe(450_000)
  })

  it('leest de k-notatie', () => {
    expect(parse('appartement Antwerpen tot 300k').hardRequirements.maxPrice).toBe(300_000)
  })

  it('leest miljoenen', () => {
    expect(parse('villa Brasschaat max 1,2 miljoen').hardRequirements.maxPrice).toBe(1_200_000)
  })

  it('interpreteert een kaal getal onder 1.000 als duizendtallen', () => {
    // "500" in een zin over huizenprijzen betekent 500.000, niet 500 euro.
    expect(parse('huis Gent onder 500').hardRequirements.maxPrice).toBe(500_000)
  })

  it('leest een minimumprijs', () => {
    expect(parse('huis Gent vanaf €200.000').hardRequirements.minPrice).toBe(200_000)
  })

  it('stopt bij een komma die geen decimaalteken is', () => {
    // "onder €500.000, minstens 3 slaapkamers" — zonder deze regel slurpt de
    // parser de komma op en wordt het bedrag onleesbaar.
    expect(
      parse('huis Gent onder €500.000, minstens 3 slaapkamers').hardRequirements.maxPrice,
    ).toBe(500_000)
  })

  it('leest de m van een volgend woord niet als miljoen', () => {
    // "€400.000 met 3 slaapkamers" werd 400 miljard zonder de lookahead achter
    // de eenheid.
    expect(parse('huis Gent onder €400.000 met 3 slaapkamers').hardRequirements.maxPrice).toBe(
      400_000,
    )
  })

  it('leest een echte miljoen-notatie wel', () => {
    expect(parse('villa onder 1,5 miljoen in Brasschaat').hardRequirements.maxPrice).toBe(
      1_500_000,
    )
    expect(parse('villa Brasschaat tot 2 mio').hardRequirements.maxPrice).toBe(2_000_000)
  })
})

describe('hard versus voorkeur', () => {
  it('behandelt "minstens" als harde eis', () => {
    expect(parse('huis Gent minstens 4 slaapkamers').hardRequirements.minBedrooms).toBe(4)
  })

  it('behandelt "liefst" als voorkeur', () => {
    const criteria = parse('huis Gent, liefst 4 slaapkamers')
    expect(criteria.preferences.minBedrooms).toBe(4)
    expect(criteria.hardRequirements.minBedrooms).toBeUndefined()
  })

  it('behandelt "bij voorkeur" als voorkeur', () => {
    const criteria = parse('appartement Gent, bij voorkeur met terras')
    expect(criteria.preferences.features).toContain('terrace')
  })

  it('zet zonder marker in harde eisen', () => {
    expect(parse('huis Gent met 3 slaapkamers').hardRequirements.minBedrooms).toBe(3)
  })
})

describe('locatie', () => {
  it('herkent meerdere gemeenten', () => {
    const criteria = parse('huis in Gent of Antwerpen')
    expect(criteria.locations).toContain('Gent')
    expect(criteria.locations).toContain('Antwerpen')
  })

  it('herkent een postcode', () => {
    expect(parse('woning in 9000 met tuin').postalCodes).toContain('9000')
  })

  it('herkent geen bouwjaar als postcode', () => {
    // 1998 valt binnen het postcodebereik; zonder deze uitzondering wordt een
    // bouwjaar een zoekgebied.
    expect(parse('huis in Gent bouwjaar 1998').postalCodes).toBeUndefined()
  })

  it('leest een straal', () => {
    expect(parse('huis binnen 15 km van Leuven').radiusKm).toBe(15)
  })

  it('negeert een straal zonder locatie', () => {
    // radiusKm zonder locatie is betekenisloos; het schema weigert die
    // combinatie, dus de parser mag hem niet doorgeven.
    expect(parse('huis binnen 15 km').radiusKm).toBeUndefined()
  })
})

describe('koop of huur', () => {
  it('is standaard koop', () => {
    expect(parse('huis in Gent').transactionType).toBe('buy')
  })

  it('herkent huur', () => {
    expect(parse('appartement te huur in Gent').transactionType).toBe('rent')
  })
})

describe('buurtvoorzieningen', () => {
  it('vereist een nabijheidswoord', () => {
    // "school" in "schoolstraat" mag geen criterium worden.
    const criteria = parse('huis in de Schoolstraat Gent')
    const nearby = [
      ...(criteria.hardRequirements.nearby ?? []),
      ...(criteria.preferences.nearby ?? []),
    ]
    expect(nearby).toHaveLength(0)
  })

  it('herkent "vlakbij scholen"', () => {
    const criteria = parse('huis in Gent vlakbij scholen')
    expect(criteria.hardRequirements.nearby?.some((n) => n.category === 'school')).toBe(true)
  })

  it('geeft een standaardafstand mee', () => {
    const criteria = parse('huis in Gent dichtbij een moskee')
    expect(criteria.hardRequirements.nearby?.[0]?.maxDistanceMeters).toBe(2000)
  })
})

describe('kenmerken en uitsluitingen', () => {
  it('herkent kenmerken', () => {
    const criteria = parse('huis Gent met tuin en garage')
    expect(criteria.hardRequirements.features).toContain('garden')
    expect(criteria.hardRequirements.features).toContain('garage')
  })

  it('herkent "geen renovatie"', () => {
    expect(parse('huis Gent, geen renovatie').hardRequirements.excludedKeywords).toContain(
      'te renoveren',
    )
  })
})

describe('robuustheid', () => {
  it('gooit nooit, ook niet op onzin', () => {
    for (const query of ['', '???', 'asdfgh', '🏠🏠🏠', 'x'.repeat(500)]) {
      expect(() => parse(query)).not.toThrow()
    }
  })

  it('geeft lege maar geldige criteria bij een onbegrijpelijke vraag', () => {
    const result = parseQueryDeterministic('asdfgh qwerty')
    expect(searchCriteriaSchema.safeParse(result.criteria).success).toBe(true)
    expect(result.recognized).toHaveLength(0)
    expect(result.unrecognized).toHaveLength(1)
  })

  it('rapporteert wat het herkende', () => {
    const result = parseQueryDeterministic('huis in Gent onder €400.000 met 3 slaapkamers')
    expect(result.recognized.length).toBeGreaterThan(0)
    expect(result.recognized.join(' ')).toContain('Gent')
  })
})

describe('samenvoegen met de AI-uitkomst', () => {
  const deterministic = searchCriteriaSchema.parse({
    locations: ['Gent'],
    postalCodes: ['9000'],
    hardRequirements: { maxPrice: 450_000 },
  })

  it('laat een letterlijk genoemd bedrag winnen van het model', () => {
    // Een bedrag dat er letterlijk staat, mag een taalmodel niet overschrijven.
    const fromModel = searchCriteriaSchema.parse({
      locations: ['Gent'],
      hardRequirements: { maxPrice: 600_000, minBedrooms: 3 },
    })

    const merged = reconcile(deterministic, fromModel)
    expect(merged.hardRequirements.maxPrice).toBe(450_000)
  })

  it('laat een letterlijk genoemde postcode winnen', () => {
    const fromModel = searchCriteriaSchema.parse({ postalCodes: ['2000'] })
    expect(reconcile(deterministic, fromModel).postalCodes).toEqual(['9000'])
  })

  it('neemt de nuance van het model over waar de parser niets vond', () => {
    const fromModel = searchCriteriaSchema.parse({
      locations: ['Gent'],
      hardRequirements: { maxPrice: 600_000, minBedrooms: 3 },
      preferences: { features: ['garden'] },
    })

    const merged = reconcile(deterministic, fromModel)
    expect(merged.hardRequirements.minBedrooms).toBe(3)
    expect(merged.preferences.features).toContain('garden')
  })

  it('valt terug op het model wanneer de samenvoeging ongeldig zou zijn', () => {
    const fromModel = searchCriteriaSchema.parse({
      locations: ['Antwerpen'],
      hardRequirements: { minBedrooms: 2 },
    })
    expect(searchCriteriaSchema.safeParse(reconcile(deterministic, fromModel)).success).toBe(true)
  })
})
