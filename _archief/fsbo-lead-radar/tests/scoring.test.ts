import { describe, expect, it } from 'vitest'

import { ageInMinutes, calculateLeadScore, type ScoringInput } from '@/domain/scoring/leadScore'

function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    classification: { type: 'private', confidence: 1, reasons: [] },
    hasPhone: true,
    ageMinutes: 4,
    territoryPrecision: 'exact',
    price: 329_000,
    listingType: 'sale',
    bedrooms: 2,
    surfaceArea: 92,
    propertyType: 'appartement',
    postalCode: '9000',
    isDuplicate: false,
    isRelist: false,
    ...overrides,
  }
}

describe('calculateLeadScore', () => {
  it('geeft de ideale lead een score van 100', () => {
    // Particulier, telefoonnummer, vier minuten oud, exacte gebiedsmatch,
    // volledige gegevens: precies het geval uit de opdracht.
    expect(calculateLeadScore(input()).total).toBe(100)
  })

  it('blijft tussen 0 en 100', () => {
    const worst = calculateLeadScore(
      input({
        classification: { type: 'professional', confidence: 1, reasons: [] },
        hasPhone: false,
        ageMinutes: 60 * 24 * 30,
        territoryPrecision: null,
        price: null,
        bedrooms: null,
        surfaceArea: null,
        propertyType: null,
        postalCode: null,
        isDuplicate: true,
      }),
    )
    expect(worst.total).toBeGreaterThanOrEqual(0)
    expect(worst.total).toBeLessThanOrEqual(100)
  })

  it('schaalt met de zekerheid dat de verkoper particulier is', () => {
    const certain = calculateLeadScore(input({ classification: { type: 'private', confidence: 1, reasons: [] } }))
    const doubtful = calculateLeadScore(
      input({ classification: { type: 'private', confidence: 0.86, reasons: [] } }),
    )
    expect(certain.total).toBeGreaterThan(doubtful.total)
  })

  it('bereikt 100 zonder erboven uit te komen', () => {
    // De vijf hoofdcomponenten tellen precies op tot 100. Zou de som hoger
    // liggen, dan zou de afkapping verschillen wegsnijden tussen leads die
    // juist onderscheiden moeten worden — zie de andere tests hieronder, die
    // allemaal vanaf de perfecte lead naar beneden vergelijken.
    const perfect = calculateLeadScore(input())
    const sum = perfect.components.reduce((total, component) => total + component.points, 0)
    expect(sum).toBe(100)
    expect(perfect.total).toBe(100)
  })

  it('beloont versheid zwaar', () => {
    const fresh = calculateLeadScore(input({ ageMinutes: 4 }))
    const stale = calculateLeadScore(input({ ageMinutes: 60 * 24 * 5 }))
    expect(fresh.total - stale.total).toBeGreaterThanOrEqual(20)
  })

  it('geeft 20 punten voor een telefoonnummer', () => {
    const withPhone = calculateLeadScore(input({ hasPhone: true }))
    const without = calculateLeadScore(input({ hasPhone: false }))
    expect(withPhone.total - without.total).toBe(20)
  })

  it('weegt een exacte postcodematch zwaarder dan een provinciematch', () => {
    const exact = calculateLeadScore(input({ territoryPrecision: 'exact' }))
    const province = calculateLeadScore(input({ territoryPrecision: 'province' }))
    expect(exact.total).toBeGreaterThan(province.total)
  })

  it('trekt een duplicaat fors omlaag', () => {
    const normal = calculateLeadScore(input({ ageMinutes: 300 }))
    const duplicate = calculateLeadScore(input({ ageMinutes: 300, isDuplicate: true }))
    expect(duplicate.total).toBeLessThan(normal.total)
  })

  it('trekt een herplaatsing lichter omlaag dan een duplicaat', () => {
    const relist = calculateLeadScore(input({ ageMinutes: 300, isRelist: true }))
    const duplicate = calculateLeadScore(input({ ageMinutes: 300, isDuplicate: true }))
    expect(relist.total).toBeGreaterThan(duplicate.total)
  })

  it('geeft een professional geen punten voor het verkoperstype', () => {
    const score = calculateLeadScore(
      input({ classification: { type: 'professional', confidence: 1, reasons: [] } }),
    )
    const sellerComponent = score.components.find((component) =>
      component.label.includes('Professionele'),
    )
    expect(sellerComponent?.points).toBe(0)
  })

  it('houdt de opbouw uitlegbaar: de componenten tellen op tot het totaal', () => {
    const score = calculateLeadScore(input({ ageMinutes: 300 }))
    const sum = score.components.reduce((total, component) => total + component.points, 0)
    expect(score.total).toBe(Math.max(0, Math.min(100, sum)))
  })

  it('beoordeelt huurprijzen op hun eigen schaal', () => {
    // €950 is een normale huurprijs en een absurde verkoopprijs.
    const rent = calculateLeadScore(input({ price: 950, listingType: 'rent' }))
    const sale = calculateLeadScore(input({ price: 950, listingType: 'sale' }))
    expect(rent.total).toBeGreaterThan(sale.total)
  })

  it('trekt punten af voor een prijs buiten elke courante range', () => {
    const normal = calculateLeadScore(input({ price: 329_000 }))
    const absurd = calculateLeadScore(input({ price: 25_000 }))
    expect(absurd.total).toBeLessThan(normal.total)
  })

  it('straft ontbrekende woninggegevens af', () => {
    const complete = calculateLeadScore(input())
    const sparse = calculateLeadScore(
      input({ bedrooms: null, surfaceArea: null, propertyType: null }),
    )
    expect(complete.total).toBeGreaterThan(sparse.total)
  })
})

describe('ageInMinutes', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('rekent minuten uit', () => {
    expect(ageInMinutes(now, new Date('2026-08-16T11:56:00Z'))).toBe(4)
  })

  it('geeft 0 voor een moment in de toekomst', () => {
    expect(ageInMinutes(now, new Date('2026-08-16T12:30:00Z'))).toBe(0)
  })

  it('geeft 0 wanneer het moment onbekend is', () => {
    expect(ageInMinutes(now, null)).toBe(0)
  })
})
