import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CLASSIFIER_OPTIONS,
  classifySeller,
  qualifiesForAutomaticAlert,
  type ClassificationSubject,
} from '@/domain/classification/classifier'
import { looksLikePersonalName, stripNegatedAgencyMentions } from '@/domain/classification/signals'

function subject(overrides: Partial<ClassificationSubject> = {}): ClassificationSubject {
  return {
    title: null,
    description: null,
    sellerName: null,
    sellerPhoneE164: null,
    sellerPhoneIsMobile: false,
    sellerTypeHint: 'unknown',
    sellerProfileUrl: null,
    sellerListingCount: null,
    ...overrides,
  }
}

describe('stripNegatedAgencyMentions', () => {
  /**
   * Dit is de belangrijkste regel in de hele classificatie. "zonder makelaar"
   * is tegelijk het sterkste particuliere signaal én bevat het sterkste
   * professionele woord. Gaat dit stuk, dan halen echte FSBO-advertenties de
   * verzenddrempel niet meer en doet de dienst niets.
   */
  it('verwijdert ontkende makelaarsvermeldingen', () => {
    expect(stripNegatedAgencyMentions('verkoop zonder makelaar in gent')).not.toContain('makelaar')
    expect(stripNegatedAgencyMentions('geen makelaarskosten')).not.toContain('makelaar')
    expect(stripNegatedAgencyMentions('van particulier aan particulier geen immokantoor')).not.toContain(
      'immokantoor',
    )
    expect(stripNegatedAgencyMentions('niet via makelaar te bezichtigen')).not.toContain('makelaar')
    expect(stripNegatedAgencyMentions('vente sans agence')).not.toContain('agence')
  })

  it('laat een gewone makelaarsvermelding staan', () => {
    expect(stripNegatedAgencyMentions('bezoek via ons vastgoedkantoor')).toContain('vastgoedkantoor')
    expect(stripNegatedAgencyMentions('uw makelaar begeleidt u')).toContain('makelaar')
  })
})

describe('classifySeller — particulier', () => {
  it('herkent "zonder makelaar" met hoge zekerheid', () => {
    const result = classifySeller(
      subject({
        title: 'Woning te koop',
        description: 'Wij verkopen zelf, zonder makelaar. Bel mij na 18u.',
        sellerName: 'Elke Vermeulen',
      }),
    )

    expect(result.type).toBe('private')
    // Boven de standaarddrempel van 0,85 — anders zou deze lead nooit verstuurd
    // worden, en dat is precies het geval waarvoor de dienst bestaat.
    expect(result.confidence).toBeGreaterThan(0.85)
    expect(result.reasons.join(' ')).toContain('zonder makelaar')
  })

  it('herkent de Franstalige formulering', () => {
    const result = classifySeller(
      subject({
        description: 'Nous vendons notre maison de particulier à particulier, sans agence.',
        sellerName: 'Marie Dubois',
      }),
    )

    expect(result.type).toBe('private')
    expect(result.confidence).toBeGreaterThan(0.85)
  })

  it('telt "geen commissie" mee als particulier signaal', () => {
    const result = classifySeller(
      subject({ description: 'Particuliere verkoop, geen makelaarskosten.', sellerName: 'Tom Peeters' }),
    )
    expect(result.type).toBe('private')
  })

  it('weegt één advertentie licht mee', () => {
    const one = classifySeller(subject({ sellerName: 'Jan Claes', sellerListingCount: 1 }))
    expect(one.type).toBe('private')
  })
})

describe('classifySeller — professioneel', () => {
  it('herkent een BIV-nummer als vrijwel sluitend bewijs', () => {
    const result = classifySeller(
      subject({ description: 'Vastgoedkantoor De Sleutel, BIV 506231. Bezoek op afspraak.' }),
    )
    expect(result.type).toBe('professional')
    expect(result.reasons.join(' ')).toContain('BIV')
  })

  it('herkent een vastgoedterm in de verkopersnaam', () => {
    const result = classifySeller(subject({ sellerName: 'Immo De Sleutel BV' }))
    expect(result.type).toBe('professional')
  })

  it('herkent een Belgisch ondernemingsnummer', () => {
    const result = classifySeller(subject({ description: 'Ondernemingsnummer BE0123.456.789' }))
    expect(result.type).toBe('professional')
  })

  it('markeert een verkoper met veel advertenties als professioneel', () => {
    const result = classifySeller(
      subject({ sellerName: 'Jan Peeters', sellerListingCount: 12 }),
      { knownActiveListings: 12 },
    )
    expect(result.type).toBe('professional')
    expect(result.reasons.join(' ')).toContain('12 gelijktijdige advertenties')
  })

  it('gebruikt de drempel uit de opties', () => {
    const strict = classifySeller(
      subject({ sellerName: 'Jan Peeters', sellerListingCount: 3 }),
      { knownActiveListings: 3 },
      { ...DEFAULT_CLASSIFIER_OPTIONS, professionalListingCountThreshold: 3 },
    )
    expect(strict.type).toBe('professional')

    const lenient = classifySeller(
      subject({ sellerName: 'Jan Peeters', sellerListingCount: 3 }),
      { knownActiveListings: 3 },
      { ...DEFAULT_CLASSIFIER_OPTIONS, professionalListingCountThreshold: 10 },
    )
    expect(lenient.type).not.toBe('professional')
  })

  it('herkent een professioneel verkopersprofiel', () => {
    const result = classifySeller(
      subject({ sellerProfileUrl: 'https://example.be/agency/de-sleutel', sellerName: 'De Sleutel' }),
    )
    expect(result.type).toBe('professional')
  })
})

describe('classifySeller — twijfel', () => {
  it('geeft "unknown" bij tegenstrijdige signalen', () => {
    // Een advertentie die zichzelf particulier noemt maar een BIV-nummer draagt
    // hoort niet automatisch verstuurd te worden, welke kant hij ook opvalt.
    const result = classifySeller(
      subject({
        description: 'Particuliere verkoop. Vastgoedkantoor Horizon, BIV 445566.',
        sellerName: 'Immo Horizon BV',
      }),
    )

    expect(result.type).not.toBe('private')
    expect(qualifiesForAutomaticAlert(result, 0.85)).toBe(false)
  })

  it('geeft "unknown" zonder enig signaal', () => {
    const result = classifySeller(subject({ title: 'Woning', description: 'Mooi gelegen.' }))
    expect(result.type).toBe('unknown')
    expect(result.confidence).toBe(0)
  })

  it('laat de bron-hint niet in zijn eentje de doorslag geven tegen sterk tegenbewijs', () => {
    const result = classifySeller(
      subject({
        sellerTypeHint: 'private',
        description: 'Ons kantoor stelt voor: ref. 8891-C. BIV 223344.',
        sellerName: 'Vastgoed Partners NV',
      }),
    )
    expect(result.type).toBe('professional')
  })
})

describe('qualifiesForAutomaticAlert', () => {
  it('laat alleen particulieren boven de drempel door', () => {
    expect(qualifiesForAutomaticAlert({ type: 'private', confidence: 0.9, reasons: [] }, 0.85)).toBe(true)
    expect(qualifiesForAutomaticAlert({ type: 'private', confidence: 0.84, reasons: [] }, 0.85)).toBe(false)
    expect(qualifiesForAutomaticAlert({ type: 'unknown', confidence: 0.99, reasons: [] }, 0.85)).toBe(false)
    expect(
      qualifiesForAutomaticAlert({ type: 'professional', confidence: 0.99, reasons: [] }, 0.85),
    ).toBe(false)
  })
})

describe('looksLikePersonalName', () => {
  it('herkent persoonsnamen', () => {
    expect(looksLikePersonalName('Jan Peeters')).toBe(true)
    expect(looksLikePersonalName('Marie-Claire D.')).toBe(true)
    expect(looksLikePersonalName('Elke')).toBe(true)
  })

  it('wijst bedrijfsnamen af', () => {
    expect(looksLikePersonalName('IMMO CENTER')).toBe(false)
    expect(looksLikePersonalName('Vastgoed Partners NV Gent')).toBe(false)
    expect(looksLikePersonalName('info@immo.be')).toBe(false)
    expect(looksLikePersonalName('Immo 2000')).toBe(false)
  })
})
