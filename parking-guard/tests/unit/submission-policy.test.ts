import { describe, expect, it } from 'vitest'

import {
  decideSubmission,
  explainDecision,
  type MunicipalityForSubmission,
} from '@/domain/municipality/submission-policy'

/**
 * Deze suite bewaakt de belangrijkste veiligheidsgrens in het product: wanneer
 * gaat een dossier met een identiteitskaart de deur uit, en waarheen.
 *
 * Elke test hier hoort te falen als iemand de poort per ongeluk openzet.
 */

const NOW = new Date('2026-08-29T12:00:00.000Z')
const RECENT = new Date('2026-08-01T00:00:00.000Z')

function municipality(
  overrides: Partial<MunicipalityForSubmission> = {},
): MunicipalityForSubmission {
  return {
    slug: 'oudergem',
    verificationStatus: 'VERIFIED',
    primaryChannel: 'EMAIL',
    submissionEmail: 'mobilite@auderghem.brussels',
    postalAddress: null,
    verifiedAt: RECENT,
    ...overrides,
  }
}

describe('decideSubmission — verificatiestatus', () => {
  it('verstuurt bij een geverifieerde gemeente met een e-mailkanaal', () => {
    const decision = decideSubmission(municipality(), { now: NOW })

    expect(decision).toEqual({
      kind: 'SEND_BY_US',
      channel: 'EMAIL',
      recipient: 'mobilite@auderghem.brussels',
    })
  })

  it.each(['UNVERIFIED', 'STALE'] as const)('verstuurt nooit bij status %s', (status) => {
    const decision = decideSubmission(municipality({ verificationStatus: status }), { now: NOW })

    expect(decision.kind).toBe('HAND_TO_USER')
    expect(decision).toMatchObject({ reason: { code: 'NOT_VERIFIED', status } })
  })

  it('verstuurt niet als VERIFIED staat maar verifiedAt ontbreekt', () => {
    // Een inconsistente registry hoort dicht te blijven, niet te gokken.
    const decision = decideSubmission(municipality({ verifiedAt: null }), { now: NOW })

    expect(decision.kind).toBe('HAND_TO_USER')
  })
})

describe('decideSubmission — veroudering van de verificatie', () => {
  it('verstuurt nog bij een verificatie van precies de maximale leeftijd', () => {
    const verifiedAt = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000)

    const decision = decideSubmission(municipality({ verifiedAt }), {
      now: NOW,
      staleAfterDays: 180,
    })

    expect(decision.kind).toBe('SEND_BY_US')
  })

  it('verstuurt niet zodra de verificatie ouder is dan toegestaan', () => {
    const verifiedAt = new Date(NOW.getTime() - 181 * 24 * 60 * 60 * 1000)

    const decision = decideSubmission(municipality({ verifiedAt }), {
      now: NOW,
      staleAfterDays: 180,
    })

    expect(decision.kind).toBe('HAND_TO_USER')
    expect(decision).toMatchObject({ reason: { code: 'VERIFICATION_EXPIRED', ageInDays: 181 } })
  })
})

describe('decideSubmission — kanalen', () => {
  it('laat de gebruiker zelf indienen bij een portaal met persoonlijke authenticatie', () => {
    // Brussel-Stad: eID mét pincode. Een pincode is persoonlijk; dit kanaal
    // hoort voor ons dicht te zijn.
    const decision = decideSubmission(
      municipality({ slug: 'brussel-stad', primaryChannel: 'ONLINE_PORTAL', submissionEmail: null }),
      { now: NOW },
    )

    expect(decision).toEqual({
      kind: 'HAND_TO_USER',
      reason: { code: 'CHANNEL_REQUIRES_USER', channel: 'ONLINE_PORTAL' },
    })
  })

  it('laat de gebruiker zelf indienen aan het loket', () => {
    const decision = decideSubmission(
      municipality({ primaryChannel: 'COUNTER', submissionEmail: null }),
      { now: NOW },
    )

    expect(decision.kind).toBe('HAND_TO_USER')
  })

  it('verstuurt niet zonder kanaal', () => {
    const decision = decideSubmission(
      municipality({ primaryChannel: null, submissionEmail: null }),
      { now: NOW },
    )

    expect(decision).toEqual({ kind: 'HAND_TO_USER', reason: { code: 'NO_CHANNEL' } })
  })

  it('gokt geen adres wanneer het kanaal EMAIL zegt maar het adres ontbreekt', () => {
    // Dit is de fout die identiteitskaarten naar een vreemde stuurt. Hij hoort
    // te leiden tot niets doen, niet tot een afgeleid adres.
    const decision = decideSubmission(municipality({ submissionEmail: null }), { now: NOW })

    expect(decision).toEqual({
      kind: 'HAND_TO_USER',
      reason: { code: 'CHANNEL_WITHOUT_ADDRESS', channel: 'EMAIL' },
    })
  })

  it('behandelt een e-mailadres van alleen spaties als ontbrekend', () => {
    const decision = decideSubmission(municipality({ submissionEmail: '   ' }), { now: NOW })

    expect(decision.kind).toBe('HAND_TO_USER')
  })
})

describe('decideSubmission — post', () => {
  const byPost = municipality({
    slug: 'schaarbeek',
    primaryChannel: 'POST',
    submissionEmail: null,
    postalAddress: 'parking.brussels, Gasthuisstraat 31, 1000 Brussel',
  })

  it('geeft het dossier standaard aan de gebruiker, want wij versturen nog geen post', () => {
    // Zolang de opdrachtgever niet beslist heeft of wij zelf posten (ADR 0005),
    // is de variant zonder kosten de default.
    const decision = decideSubmission(byPost, { now: NOW })

    expect(decision.kind).toBe('HAND_TO_USER')
  })

  it('verstuurt per post zodra dat aanstaat', () => {
    const decision = decideSubmission(byPost, { now: NOW, weSendPost: true })

    expect(decision).toEqual({
      kind: 'SEND_BY_US',
      channel: 'POST',
      recipient: 'parking.brussels, Gasthuisstraat 31, 1000 Brussel',
    })
  })

  it('verstuurt geen post zonder postadres, ook niet als posten aanstaat', () => {
    const decision = decideSubmission(
      { ...byPost, postalAddress: null },
      { now: NOW, weSendPost: true },
    )

    expect(decision).toMatchObject({ reason: { code: 'CHANNEL_WITHOUT_ADDRESS', channel: 'POST' } })
  })
})

describe('explainDecision', () => {
  it('belooft nooit automatische indiening wanneer de gebruiker zelf moet indienen', () => {
    const decision = decideSubmission(
      municipality({ primaryChannel: 'ONLINE_PORTAL', submissionEmail: null }),
      { now: NOW },
    )

    const nl = explainDecision(decision, 'NL')
    const fr = explainDecision(decision, 'FR')

    expect(nl).toContain('zelf indient')
    expect(fr).toContain('vous-même')
    // Werkregel 2: geen "100% automatisch" waar een mens moet handelen.
    expect(nl.toLowerCase()).not.toContain('automatisch')
    expect(fr.toLowerCase()).not.toContain('automatique')
  })

  it('geeft NL en FR terug voor elke uitkomst', () => {
    const cases: MunicipalityForSubmission[] = [
      municipality(),
      municipality({ verificationStatus: 'UNVERIFIED' }),
      municipality({ primaryChannel: 'COUNTER', submissionEmail: null }),
      municipality({ primaryChannel: null, submissionEmail: null }),
    ]

    for (const entry of cases) {
      const decision = decideSubmission(entry, { now: NOW })
      expect(explainDecision(decision, 'NL').length).toBeGreaterThan(10)
      expect(explainDecision(decision, 'FR').length).toBeGreaterThan(10)
    }
  })
})
