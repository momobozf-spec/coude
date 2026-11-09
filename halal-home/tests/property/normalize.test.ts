import { describe, expect, it } from 'vitest'

import {
  dedupeBatch,
  diffProperty,
  findDuplicate,
  fingerprint,
  normalizeEpcLabel,
  normalizeListing,
  normalizePostalCode,
  normalizePrice,
  normalizeUrl,
  type ExistingProperty,
  type NormalizedProperty,
} from '@/modules/property/domain/normalize'
import type { RawPropertyListing } from '@/types/propertySource'

describe('URL normaliseren', () => {
  it('verwijdert tracking-parameters', () => {
    // Dezelfde woning via een nieuwsbrieflink mag geen tweede pand worden.
    expect(normalizeUrl('https://example.com/huis/123?utm_source=nieuwsbrief')).toBe(
      'https://example.com/huis/123',
    )
  })

  it('verwijdert de fragment-identifier', () => {
    expect(normalizeUrl('https://example.com/huis/123#fotos')).toBe(
      'https://example.com/huis/123',
    )
  })

  it('behoudt parameters die het pand identificeren', () => {
    // Sommige bronnen zetten het id in de query; dat weggooien maakt alle
    // panden van die bron identiek.
    expect(normalizeUrl('https://example.com/detail?id=456&utm_medium=mail')).toContain('id=456')
  })

  it('maakt host en protocol uniform', () => {
    expect(normalizeUrl('http://WWW.Example.com/Huis/123')).toBe(
      'https://example.com/Huis/123',
    )
  })

  it('verwijdert een afsluitende slash', () => {
    expect(normalizeUrl('https://example.com/huis/123/')).toBe('https://example.com/huis/123')
  })

  it('herkent twee ingangen naar dezelfde pagina als gelijk', () => {
    expect(normalizeUrl('https://www.example.com/huis/123?utm_source=x#foto')).toBe(
      normalizeUrl('http://example.com/huis/123/'),
    )
  })

  it('gooit niet op een ongeldige URL', () => {
    // Een pand met een rare URL is nog steeds een pand.
    expect(() => normalizeUrl('niet-echt-een-url')).not.toThrow()
  })
})

describe('prijs normaliseren', () => {
  it('leest een getal', () => {
    expect(normalizePrice(450_000)).toBe(450_000)
  })

  it('leest Belgische notatie', () => {
    expect(normalizePrice('€ 450.000')).toBe(450_000)
    expect(normalizePrice('450.000,00')).toBe(450_000)
  })

  it('gooit centen weg', () => {
    // Vastgoedprijzen kennen geen centen; zie de kop van schema.prisma.
    expect(normalizePrice('450000,99')).toBe(450_000)
  })

  it('geeft null bij onleesbare invoer', () => {
    for (const input of ['op aanvraag', '', null, undefined, 0, -5]) {
      expect(normalizePrice(input)).toBeNull()
    }
  })
})

describe('EPC normaliseren', () => {
  it('leest de gangbare schrijfwijzen', () => {
    expect(normalizeEpcLabel('a+')).toBe('A+')
    expect(normalizeEpcLabel('A ++')).toBe('A++')
    expect(normalizeEpcLabel('label B')).toBe('B')
  })

  it('geeft null wanneer er geen label in staat', () => {
    expect(normalizeEpcLabel('in aanvraag')).toBeNull()
    expect(normalizeEpcLabel(null)).toBeNull()
  })
})

describe('postcode normaliseren', () => {
  it('haalt vier cijfers eruit', () => {
    expect(normalizePostalCode('9000 Gent')).toBe('9000')
  })

  it('geeft null bij een andere vorm', () => {
    expect(normalizePostalCode('B-90000')).toBeNull()
    expect(normalizePostalCode(null)).toBeNull()
  })
})

const raw = (overrides: Partial<RawPropertyListing> = {}): RawPropertyListing => ({
  externalId: 'abc-1',
  url: 'https://example.com/huis/1',
  title: '  Mooie woning  ',
  address: 'Voorbeeldstraat 12',
  postalCode: '9000 Gent',
  city: 'Gent',
  price: '€ 450.000',
  bedrooms: '3',
  livingAreaM2: 150,
  epcLabel: 'a+',
  features: ['Tuin', 'GARAGE', 'tuin'],
  ...overrides,
})

describe('een listing normaliseren', () => {
  it('maakt alle velden uniform', () => {
    const result = normalizeListing('fixture', raw())

    expect(result.title).toBe('Mooie woning')
    expect(result.price).toBe(450_000)
    expect(result.postalCode).toBe('9000')
    expect(result.bedrooms).toBe(3)
    expect(result.epcLabel).toBe('A+')
    expect(result.source).toBe('fixture')
  })

  it('ontdubbelt en normaliseert kenmerken', () => {
    expect(normalizeListing('fixture', raw()).features).toEqual(['tuin', 'garage'])
  })

  it('zet onleesbare waarden op null in plaats van te gokken', () => {
    // Een verkeerd gelezen prijs is erger dan een ontbrekende: de matcher
    // behandelt onbekend als onbekend, maar een fout getal als feit.
    const result = normalizeListing('fixture', raw({ price: 'op aanvraag', bedrooms: 'veel' }))

    expect(result.price).toBeNull()
    expect(result.bedrooms).toBeNull()
  })

  it('weigert een onwaarschijnlijk bouwjaar', () => {
    expect(normalizeListing('fixture', raw({ buildYear: 1200 })).buildYear).toBeNull()
    expect(normalizeListing('fixture', raw({ buildYear: 1998 })).buildYear).toBe(1998)
  })

  it('is deterministisch', () => {
    const a = normalizeListing('fixture', raw())
    const b = normalizeListing('fixture', raw())
    expect(a).toEqual(b)
  })
})

describe('vingerafdruk', () => {
  it('is gelijk voor hetzelfde pand', () => {
    const input = { address: 'Voorbeeldstraat 12', postalCode: '9000', price: 450_000 }
    expect(fingerprint(input)).toBe(fingerprint(input))
  })

  it('negeert verschillen in spaties en hoofdletters', () => {
    expect(fingerprint({ address: 'Voorbeeldstraat  12', postalCode: '9000' })).toBe(
      fingerprint({ address: 'voorbeeldstraat 12', postalCode: '9000' }),
    )
  })

  it('verschilt bij een andere prijs', () => {
    expect(fingerprint({ address: 'A 1', price: 100 })).not.toBe(
      fingerprint({ address: 'A 1', price: 200 }),
    )
  })
})

const existing = (overrides: Partial<ExistingProperty> = {}): ExistingProperty => ({
  id: 'p1',
  source: 'fixture',
  externalId: 'abc-1',
  urlNormalized: 'https://example.com/huis/1',
  fingerprint: 'fp-1',
  ...overrides,
})

describe('duplicaten vinden', () => {
  const candidate = {
    source: 'fixture',
    externalId: 'abc-1',
    urlNormalized: 'https://example.com/huis/1',
    fingerprint: 'fp-1',
  }

  it('herkent dezelfde bron en id als zeker', () => {
    const found = findDuplicate(candidate, [existing()])
    expect(found?.match).toEqual({ level: 'exact', confident: true })
  })

  it('herkent dezelfde URL als zeker', () => {
    const found = findDuplicate({ ...candidate, externalId: 'anders' }, [existing()])
    expect(found?.match).toEqual({ level: 'url', confident: true })
  })

  it('behandelt een gelijke vingerafdruk als onzeker', () => {
    // Twee identieke nieuwbouwappartementen in hetzelfde gebouw geven dezelfde
    // vingerafdruk. Die mag je niet blind samenvoegen.
    const found = findDuplicate(
      { ...candidate, externalId: 'anders', urlNormalized: 'https://ander.be/x' },
      [existing()],
    )
    expect(found?.match).toEqual({ level: 'fingerprint', confident: false })
  })

  it('geeft null wanneer er geen match is', () => {
    expect(
      findDuplicate(
        {
          source: 'ander',
          externalId: 'xyz',
          urlNormalized: 'https://ander.be/y',
          fingerprint: 'fp-2',
        },
        [existing()],
      ),
    ).toBeNull()
  })
})

describe('een batch ontdubbelen', () => {
  const item = (overrides: Partial<NormalizedProperty>): NormalizedProperty =>
    ({
      source: 'fixture',
      externalId: 'a',
      urlNormalized: 'https://example.com/1',
      ...overrides,
    }) as NormalizedProperty

  it('houdt het eerste exemplaar bij een dubbele sleutel', () => {
    const result = dedupeBatch([
      item({ externalId: 'a', title: 'eerste' } as Partial<NormalizedProperty>),
      item({ externalId: 'a', title: 'tweede' } as Partial<NormalizedProperty>),
    ])
    expect(result).toHaveLength(1)
  })

  it('ontdubbelt ook op URL, over bronnen heen', () => {
    // Twee bronnen kunnen in dezelfde run hetzelfde pand aanleveren.
    const result = dedupeBatch([
      item({ source: 'a', externalId: '1' }),
      item({ source: 'b', externalId: '2' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('laat verschillende panden staan', () => {
    const result = dedupeBatch([
      item({ externalId: '1', urlNormalized: 'https://example.com/1' }),
      item({ externalId: '2', urlNormalized: 'https://example.com/2' }),
    ])
    expect(result).toHaveLength(2)
  })
})

describe('wijzigingen bepalen', () => {
  const after = { price: 430_000, bedrooms: 3, title: 'Woning' } as NormalizedProperty

  it('meldt een prijswijziging', () => {
    const changes = diffProperty({ price: 450_000 }, after)
    expect(changes).toContainEqual({
      field: 'price',
      oldValue: '450000',
      newValue: '430000',
    })
  })

  it('meldt niets wanneer er niets veranderde', () => {
    expect(diffProperty({ price: 430_000, bedrooms: 3, title: 'Woning' }, after)).toHaveLength(0)
  })

  it('meldt niet dat een veld onbekend is geworden', () => {
    // Een bron die een veld tijdelijk niet levert, mag geen "prijs verwijderd"
    // opleveren.
    const withoutPrice = { price: null } as unknown as NormalizedProperty
    expect(diffProperty({ price: 450_000 }, withoutPrice)).toHaveLength(0)
  })

  it('meldt wél dat een eerder onbekend veld nu bekend is', () => {
    // Andersom is het wél nieuws: de bron vult iets aan dat eerst ontbrak.
    const changes = diffProperty({}, { bedrooms: 3 } as NormalizedProperty)
    expect(changes).toContainEqual({ field: 'bedrooms', oldValue: null, newValue: '3' })
  })
})
