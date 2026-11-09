import { describe, expect, it } from 'vitest'

import { findBestDuplicate, isLikelyRelist, scoreDuplicate } from '@/domain/dedupe/matcher'
import type { DuplicateCandidate } from '@/domain/types'

type Incoming = Parameters<typeof scoreDuplicate>[0]

function incoming(overrides: Partial<Incoming> = {}): Incoming {
  return {
    source: 'bron-a',
    title: 'Instapklaar appartement met terras',
    description: 'Ruim appartement van 92 m² met twee slaapkamers en een zuidgericht terras.',
    price: 329_000,
    postalCode: '9000',
    address: 'Nieuwewandeling 42',
    surfaceArea: 92,
    bedrooms: 2,
    sellerPhoneE164: '+32475123456',
    ...overrides,
  }
}

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    id: 'listing-1',
    source: 'bron-b',
    sourceListingId: 'b-1',
    title: 'Appartement met 2 slaapkamers, terras zuid',
    description: 'Zeer verzorgd appartement, 90 m², twee slaapkamers, terras op het zuiden.',
    price: 335_000,
    postalCode: '9000',
    address: 'Nieuwewandeling 42 bus 3',
    surfaceArea: 90,
    bedrooms: 2,
    sellerPhoneE164: '+32475123456',
    fingerprint: null,
    ...overrides,
  }
}

describe('scoreDuplicate', () => {
  it('herkent dezelfde woning op twee bronnen', () => {
    const result = scoreDuplicate(incoming(), candidate())
    expect(result.confidence).toBeGreaterThan(0.85)
    expect(result.reasons).toContain('Identiek telefoonnummer van de verkoper')
  })

  it('werkt ook zonder telefoonnummer', () => {
    const result = scoreDuplicate(
      incoming({ sellerPhoneE164: null }),
      candidate({ sellerPhoneE164: null }),
    )
    expect(result.confidence).toBeGreaterThan(0.72)
  })

  it('wijst een andere postcode hard af', () => {
    // Een verschillende postcode is bewijs *tegen*, hoe goed de rest ook matcht.
    const result = scoreDuplicate(incoming(), candidate({ postalCode: '2000' }))
    expect(result.confidence).toBeLessThan(0.25)
    expect(result.reasons.join(' ')).toContain('Verschillende postcode')
  })

  it('laat hetzelfde nummer een slechte woningmatch niet redden', () => {
    // Een verkoper kan twee panden hebben. Hetzelfde nummer maakt van twee
    // verschillende woningen geen duplicaat.
    const result = scoreDuplicate(
      incoming(),
      candidate({
        title: 'Bouwgrond 6 are',
        description: 'Perceel bouwgrond, vrij van bouwverplichting.',
        price: 195_000,
        address: 'Kiezelstraat 88',
        surfaceArea: 600,
        bedrooms: null,
      }),
    )
    expect(result.confidence).toBeLessThan(0.72)
  })

  it('straft een verschillend huisnummer bij dezelfde straat af', () => {
    const result = scoreDuplicate(
      incoming({ sellerPhoneE164: null, address: 'Kerkstraat 12' }),
      candidate({ sellerPhoneE164: null, address: 'Kerkstraat 84' }),
    )
    // Zelfde straat, ander nummer: andere woning.
    expect(result.reasons).not.toContain('Vergelijkbaar adres')
  })

  it('geeft geen oordeel bij te weinig vergelijkbare velden', () => {
    const result = scoreDuplicate(
      incoming({
        title: null,
        description: null,
        price: null,
        address: null,
        surfaceArea: null,
        bedrooms: null,
        sellerPhoneE164: null,
      }),
      candidate({
        title: null,
        description: null,
        price: null,
        address: null,
        surfaceArea: null,
        bedrooms: null,
        sellerPhoneE164: null,
      }),
    )
    expect(result.confidence).toBe(0)
    expect(result.reasons.join(' ')).toContain('Te weinig vergelijkbare velden')
  })

  it('verdraagt een prijsverschil van een paar procent', () => {
    const result = scoreDuplicate(
      incoming({ sellerPhoneE164: null, price: 329_000 }),
      candidate({ sellerPhoneE164: null, price: 339_000 }),
    )
    expect(result.confidence).toBeGreaterThan(0.6)
  })

  it('herkent een herschreven beschrijving als dezelfde woning', () => {
    const result = scoreDuplicate(
      incoming({
        sellerPhoneE164: null,
        description:
          'Terras op het zuiden, twee slaapkamers, kelderberging, negentig vierkante meter bewoonbaar.',
      }),
      candidate({ sellerPhoneE164: null }),
    )
    expect(result.confidence).toBeGreaterThan(0.6)
  })
})

describe('findBestDuplicate', () => {
  it('kiest de sterkste match boven de drempel', () => {
    const match = findBestDuplicate(
      incoming(),
      [
        candidate({ id: 'zwak', price: 280_000, address: 'Andere straat 3', sellerPhoneE164: null }),
        candidate({ id: 'sterk' }),
      ],
      0.72,
    )

    expect(match?.listingId).toBe('sterk')
    expect(match?.confidence).toBeGreaterThan(0.85)
  })

  it('slaat advertenties uit dezelfde bron over', () => {
    // Binnen één bron is `source + sourceListingId` al de identiteit; twee
    // verschillende id's zijn twee advertenties, geen duplicaat.
    const match = findBestDuplicate(incoming(), [candidate({ source: 'bron-a' })], 0.72)
    expect(match).toBeNull()
  })

  it('geeft null wanneer niets de drempel haalt', () => {
    const match = findBestDuplicate(incoming(), [candidate({ postalCode: '8000' })], 0.72)
    expect(match).toBeNull()
  })

  it('geeft null bij een lege kandidatenlijst', () => {
    expect(findBestDuplicate(incoming(), [], 0.72)).toBeNull()
  })
})

describe('isLikelyRelist', () => {
  it('herkent een herplaatsing binnen dezelfde bron', () => {
    expect(
      isLikelyRelist(incoming(), candidate({ source: 'bron-a', title: incoming().title })),
    ).toBe(true)
  })

  it('noemt een advertentie van een andere bron geen herplaatsing', () => {
    expect(isLikelyRelist(incoming(), candidate({ source: 'bron-b' }))).toBe(false)
  })
})
