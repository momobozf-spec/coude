import { describe, expect, it } from 'vitest'

import {
  compareProperties,
  ComparisonError,
  MAX_COMPARE,
  MIN_COMPARE,
  pricePerSquareMeter,
  type ComparableProperty,
} from '@/modules/property/domain/comparison'

const property = (overrides: Partial<ComparableProperty> = {}): ComparableProperty => ({
  id: 'p1',
  title: 'Woning',
  city: 'Gent',
  imageUrl: null,
  price: 400_000,
  bedrooms: 3,
  bathrooms: 1,
  livingAreaM2: 150,
  landAreaM2: 200,
  epcLabel: 'B',
  buildYear: 2000,
  features: ['garden'],
  ...overrides,
})

const rowFor = (comparison: ReturnType<typeof compareProperties>, key: string) =>
  comparison.rows.find((r) => r.key === key)

describe('grenzen', () => {
  it('weigert minder dan het minimum', () => {
    expect(() => compareProperties([property()])).toThrow(ComparisonError)
  })

  it('weigert meer dan het maximum', () => {
    // Meer dan vier kolommen wordt onleesbaar, zeker op een telefoon.
    const many = Array.from({ length: MAX_COMPARE + 1 }, (_, i) =>
      property({ id: `p${i}` }),
    )
    expect(() => compareProperties(many)).toThrow(ComparisonError)
  })

  it('accepteert het minimum en het maximum', () => {
    for (const count of [MIN_COMPARE, MAX_COMPARE]) {
      const properties = Array.from({ length: count }, (_, i) => property({ id: `p${i}` }))
      expect(() => compareProperties(properties)).not.toThrow()
    }
  })
})

describe('prijs per m²', () => {
  it('rekent uit', () => {
    expect(pricePerSquareMeter(property({ price: 400_000, livingAreaM2: 200 }))).toBe(2_000)
  })

  it('geeft null zonder prijs of oppervlakte', () => {
    expect(pricePerSquareMeter(property({ price: null }))).toBeNull()
    expect(pricePerSquareMeter(property({ livingAreaM2: null }))).toBeNull()
    expect(pricePerSquareMeter(property({ livingAreaM2: 0 }))).toBeNull()
  })
})

describe('gunstigste waarde aanwijzen', () => {
  it('kiest de laagste prijs', () => {
    const comparison = compareProperties([
      property({ id: 'goedkoop', price: 300_000 }),
      property({ id: 'duur', price: 500_000 }),
    ])

    const row = rowFor(comparison, 'price')
    expect(row?.cells.find((c) => c.propertyId === 'goedkoop')?.best).toBe(true)
    expect(row?.cells.find((c) => c.propertyId === 'duur')?.best).toBe(false)
  })

  it('kiest de meeste slaapkamers', () => {
    const comparison = compareProperties([
      property({ id: 'klein', bedrooms: 2 }),
      property({ id: 'groot', bedrooms: 4 }),
    ])
    expect(
      rowFor(comparison, 'bedrooms')?.cells.find((c) => c.propertyId === 'groot')?.best,
    ).toBe(true)
  })

  it('kiest het beste EPC-label, waar lager beter is', () => {
    // A++ heeft index 0 in de labellijst: bij EPC is een lagere rang beter.
    const comparison = compareProperties([
      property({ id: 'zuinig', epcLabel: 'A' }),
      property({ id: 'slecht', epcLabel: 'E' }),
    ])
    expect(rowFor(comparison, 'epc')?.cells.find((c) => c.propertyId === 'zuinig')?.best).toBe(
      true,
    )
  })

  it('wijst niemand aan bij gelijkspel', () => {
    const comparison = compareProperties([
      property({ id: 'a', price: 400_000 }),
      property({ id: 'b', price: 400_000 }),
    ])
    expect(rowFor(comparison, 'price')?.cells.every((c) => !c.best)).toBe(true)
  })

  it('wijst niemand aan wanneer maar één woning de waarde heeft', () => {
    // Met één bekende waarde valt er niets te kiezen.
    const comparison = compareProperties([
      property({ id: 'a', buildYear: 2010 }),
      property({ id: 'b', buildYear: null }),
    ])
    expect(rowFor(comparison, 'buildYear')?.cells.every((c) => !c.best)).toBe(true)
  })
})

describe('onbekende gegevens', () => {
  it('toont een streepje en telt het als onbekend', () => {
    const comparison = compareProperties([
      property({ id: 'a', epcLabel: 'B' }),
      property({ id: 'b', epcLabel: null }),
    ])

    const row = rowFor(comparison, 'epc')
    expect(row?.unknownCount).toBe(1)
    expect(row?.cells.find((c) => c.propertyId === 'b')?.display).toBe('—')
  })

  it('laat een rij weg waarvoor niemand een waarde heeft', () => {
    // Een tabel vol streepjes leidt af van de rijen die er wél toe doen.
    const comparison = compareProperties([
      property({ id: 'a', landAreaM2: null }),
      property({ id: 'b', landAreaM2: null }),
    ])
    expect(rowFor(comparison, 'landAreaM2')).toBeUndefined()
  })

  it('markeert een onbekende waarde nooit als gunstigst', () => {
    const comparison = compareProperties([
      property({ id: 'a', price: 400_000 }),
      property({ id: 'b', price: null }),
    ])
    expect(rowFor(comparison, 'price')?.cells.find((c) => c.propertyId === 'b')?.best).toBe(false)
  })
})

describe('kenmerken', () => {
  it('toont alleen kenmerken waarin de woningen verschillen', () => {
    // Een kenmerk dat alle woningen hebben, helpt niet bij kiezen.
    const comparison = compareProperties([
      property({ id: 'a', features: ['garden', 'garage'] }),
      property({ id: 'b', features: ['garden'] }),
    ])

    const features = comparison.featureRows.map((r) => r.feature)
    expect(features).toContain('garage')
    expect(features).not.toContain('garden')
  })

  it('geeft per woning aan of hij het kenmerk heeft', () => {
    const comparison = compareProperties([
      property({ id: 'a', features: ['garage'] }),
      property({ id: 'b', features: [] }),
    ])

    const row = comparison.featureRows.find((r) => r.feature === 'garage')
    expect(row?.present.a).toBe(true)
    expect(row?.present.b).toBe(false)
  })
})

describe('geen totaalscore', () => {
  it('wijst geen winnaar aan', () => {
    // De vergelijking markeert per rij de gunstigste waarde en laat de afweging
    // aan de gebruiker. Een totaalscore zou die afweging verbergen.
    const comparison = compareProperties([
      property({ id: 'a', price: 300_000, bedrooms: 2 }),
      property({ id: 'b', price: 500_000, bedrooms: 5 }),
    ])

    expect(comparison).not.toHaveProperty('winner')
    expect(comparison).not.toHaveProperty('bestPropertyId')
    // Beide woningen zijn ergens de gunstigste: precies de afweging die de
    // gebruiker zelf moet maken.
    expect(rowFor(comparison, 'price')?.cells.find((c) => c.propertyId === 'a')?.best).toBe(true)
    expect(rowFor(comparison, 'bedrooms')?.cells.find((c) => c.propertyId === 'b')?.best).toBe(
      true,
    )
  })
})
