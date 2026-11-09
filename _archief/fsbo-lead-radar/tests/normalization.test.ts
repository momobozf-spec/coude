import { describe, expect, it } from 'vitest'

import {
  NormalizationError,
  buildContentHash,
  buildFingerprint,
  extractBedrooms,
  extractSurfaceArea,
  inferListingType,
  normalizeListing,
  normalizePropertyType,
  parsePrice,
} from '@/domain/normalization'
import type { RawListing } from '@/domain/types'

const SCRAPED_AT = new Date('2026-08-16T10:00:00Z')

function raw(overrides: Partial<RawListing> = {}): RawListing {
  return {
    source: 'test',
    sourceListingId: 'abc-1',
    url: 'https://example.be/zoekertje/abc-1',
    scrapedAt: SCRAPED_AT,
    ...overrides,
  }
}

describe('parsePrice', () => {
  it('leest de Belgische notatie met punt als duizendtalscheiding', () => {
    // Dit is het geval dat fout gaat als je de Angelsaksische conventie
    // aanhoudt: "329.000" zou dan 329 euro worden.
    expect(parsePrice('€ 329.000')).toBe(329_000)
    expect(parsePrice('329.000')).toBe(329_000)
    expect(parsePrice('1.250.000 EUR')).toBe(1_250_000)
  })

  it('leest de komma als decimaalteken', () => {
    expect(parsePrice('329.000,50')).toBe(329_001)
    expect(parsePrice('950,00')).toBe(950)
  })

  it('herkent een punt met twee decimalen als decimaalpunt', () => {
    expect(parsePrice('1250.50')).toBe(1251)
  })

  it('gaat om met spaties en valutatekens', () => {
    expect(parsePrice('€ 329 000')).toBe(329_000)
    expect(parsePrice('EUR 950')).toBe(950)
  })

  it('geeft null voor onzin', () => {
    expect(parsePrice('op aanvraag')).toBeNull()
    expect(parsePrice('')).toBeNull()
    expect(parsePrice(null)).toBeNull()
    expect(parsePrice(undefined)).toBeNull()
  })

  it('neemt getallen ongewijzigd over', () => {
    expect(parsePrice(329_000)).toBe(329_000)
    expect(parsePrice(-5)).toBeNull()
  })
})

describe('inferListingType', () => {
  it('volgt de bron wanneer die het weet', () => {
    expect(inferListingType('rent', 'te koop woning', 350_000)).toBe('rent')
  })

  it('leidt huur af uit de tekst', () => {
    expect(inferListingType(undefined, 'appartement te huur in Gent', null)).toBe('rent')
    expect(inferListingType(undefined, 'maison à louer', null)).toBe('rent')
  })

  it('leidt verkoop af uit de tekst', () => {
    expect(inferListingType(undefined, 'woning te koop, vraagprijs bespreekbaar', null)).toBe('sale')
  })

  it('gebruikt de prijs als de tekst niets zegt', () => {
    expect(inferListingType(undefined, 'mooi pand', 950)).toBe('rent')
    expect(inferListingType(undefined, 'mooi pand', 329_000)).toBe('sale')
  })

  it('geeft null wanneer beide kanten genoemd worden en de prijs niets uitwijst', () => {
    expect(inferListingType(undefined, 'te koop of te huur', 20_000)).toBeNull()
  })
})

describe('veldextractie uit vrije tekst', () => {
  it('vindt slaapkamers in drie talen', () => {
    expect(extractBedrooms('ruime woning met 3 slaapkamers')).toBe(3)
    expect(extractBedrooms('maison avec 4 chambres')).toBe(4)
    expect(extractBedrooms('house with 2 bedrooms')).toBe(2)
    expect(extractBedrooms('2 slpk en badkamer')).toBe(2)
  })

  it('vindt oppervlakte in verschillende schrijfwijzen', () => {
    expect(extractSurfaceArea('92 m²')).toBe(92)
    expect(extractSurfaceArea('120m2 bewoonbaar')).toBe(120)
    expect(extractSurfaceArea('85 vierkante meter')).toBe(85)
  })

  it('geeft null zonder treffer', () => {
    expect(extractBedrooms('gezellige woning')).toBeNull()
    expect(extractSurfaceArea('gezellige woning')).toBeNull()
  })
})

describe('normalizePropertyType', () => {
  it('brengt varianten terug tot één term', () => {
    expect(normalizePropertyType('Appartement')).toBe('appartement')
    expect(normalizePropertyType('Studio')).toBe('appartement')
    expect(normalizePropertyType('Villa')).toBe('huis')
    expect(normalizePropertyType('Maison')).toBe('huis')
    expect(normalizePropertyType('Bouwgrond')).toBe('grond')
  })
})

describe('normalizeListing', () => {
  it('normaliseert een volledige advertentie', () => {
    const result = normalizeListing(
      raw({
        title: '  Instapklaar   appartement  ',
        description: 'Ruim appartement met 2 slaapkamers, 92 m². Bel 0475 12 34 56.',
        price: 329_000,
        postalCode: '9000',
        city: 'Gent',
        address: 'Nieuwewandeling 42',
        listingType: 'sale',
        propertyType: 'Appartement',
      }),
    )

    expect(result.title).toBe('Instapklaar appartement')
    expect(result.price).toBe(329_000)
    expect(result.postalCode).toBe('9000')
    expect(result.province).toBe('oost-vlaanderen')
    expect(result.city).toBe('Gent')
    expect(result.bedrooms).toBe(2)
    expect(result.surfaceArea).toBe(92)
    expect(result.propertyType).toBe('appartement')
    // Het nummer stond alleen in de beschrijving; particulieren doen dat vaak.
    expect(result.sellerPhoneE164).toBe('+32475123456')
    expect(result.sellerPhoneIsMobile).toBe(true)
  })

  it('haalt de postcode uit het adres als het eigen veld ontbreekt', () => {
    const result = normalizeListing(raw({ address: 'Kerkstraat 12, 8500 Kortrijk' }))
    expect(result.postalCode).toBe('8500')
    expect(result.province).toBe('west-vlaanderen')
  })

  it('haalt de postcode uit de stadsnaam', () => {
    const result = normalizeListing(raw({ city: '2000 Antwerpen' }))
    expect(result.postalCode).toBe('2000')
    expect(result.city).toBe('Antwerpen')
  })

  it('weigert een buitenlandse postcode', () => {
    // Vijf cijfers is Frankrijk of Duitsland, geen Belgische postcode.
    const result = normalizeListing(raw({ postalCode: '75001', city: 'Paris' }))
    expect(result.postalCode).toBeNull()
    expect(result.province).toBeNull()
  })

  it('geeft coördinaten op basis van de postcode, voor radius-gebieden', () => {
    const result = normalizeListing(raw({ postalCode: '9000' }))
    expect(result.latitude).toBeCloseTo(51.0543, 3)
    expect(result.longitude).toBeCloseTo(3.7174, 3)
  })

  it('gooit een NormalizationError bij een onbruikbare advertentie', () => {
    expect(() => normalizeListing(raw({ url: 'geen-url' }))).toThrow(NormalizationError)
    expect(() => normalizeListing(raw({ sourceListingId: '' }))).toThrow(NormalizationError)
  })

  it('is deterministisch: dezelfde invoer geeft dezelfde contentHash', () => {
    const input = raw({ title: 'Woning', price: 250_000, postalCode: '9000' })
    expect(normalizeListing(input).contentHash).toBe(normalizeListing(input).contentHash)
  })

  it('geeft een andere contentHash bij een prijswijziging', () => {
    const before = normalizeListing(raw({ title: 'Woning', price: 250_000, postalCode: '9000' }))
    const after = normalizeListing(raw({ title: 'Woning', price: 245_000, postalCode: '9000' }))
    expect(before.contentHash).not.toBe(after.contentHash)
  })

  it('laat de contentHash ongemoeid als alleen scrapedAt verschilt', () => {
    // Anders zou elke run een wijziging lijken en de historiek vervuilen.
    const first = normalizeListing(raw({ title: 'Woning', price: 250_000 }))
    const second = normalizeListing(
      raw({ title: 'Woning', price: 250_000, scrapedAt: new Date('2026-08-16T11:30:00Z') }),
    )
    expect(first.contentHash).toBe(second.contentHash)
  })
})

describe('buildFingerprint', () => {
  it('geeft dezelfde sleutel voor licht afwijkende oppervlaktes', () => {
    const a = buildFingerprint({ postalCode: '9000', price: 329_000, surfaceArea: 92, bedrooms: 2, listingType: 'sale' })
    const b = buildFingerprint({ postalCode: '9000', price: 335_000, surfaceArea: 90, bedrooms: 2, listingType: 'sale' })
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('negeert de prijs — die is een gradueel signaal, geen blokkeersleutel', () => {
    const cheap = buildFingerprint({ postalCode: '9000', price: 200_000, surfaceArea: 92, bedrooms: 2, listingType: 'sale' })
    const expensive = buildFingerprint({ postalCode: '9000', price: 900_000, surfaceArea: 92, bedrooms: 2, listingType: 'sale' })
    expect(cheap).toBe(expensive)
  })

  it('scheidt verschillende postcodes', () => {
    const gent = buildFingerprint({ postalCode: '9000', price: null, surfaceArea: 92, bedrooms: 2, listingType: 'sale' })
    const brugge = buildFingerprint({ postalCode: '8000', price: null, surfaceArea: 92, bedrooms: 2, listingType: 'sale' })
    expect(gent).not.toBe(brugge)
  })

  it('geeft null wanneer er te weinig te blokkeren valt', () => {
    expect(
      buildFingerprint({ postalCode: null, price: 329_000, surfaceArea: 92, bedrooms: 2, listingType: 'sale' }),
    ).toBeNull()
    expect(
      buildFingerprint({ postalCode: '9000', price: 329_000, surfaceArea: null, bedrooms: null, listingType: 'sale' }),
    ).toBeNull()
  })
})

describe('buildContentHash', () => {
  const base = {
    title: 'Woning',
    description: 'Mooi',
    price: 250_000,
    postalCode: '9000',
    address: 'Kerkstraat 1',
    bedrooms: 3,
    surfaceArea: 120,
    listingType: 'sale',
    propertyType: 'huis',
    sellerName: 'Jan',
    sellerPhoneE164: '+32475123456',
  }

  it('is ongevoelig voor hoofdletters en leestekens in tekstvelden', () => {
    expect(buildContentHash(base)).toBe(
      buildContentHash({ ...base, title: 'WONING!', address: 'kerkstraat, 1' }),
    )
  })

  it('reageert op een prijswijziging', () => {
    expect(buildContentHash(base)).not.toBe(buildContentHash({ ...base, price: 240_000 }))
  })
})
