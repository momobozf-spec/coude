import { describe, expect, it } from 'vitest'

import { deriveZakatStatus } from '@/server/modules/charities/transparency/zakat-status'
import type { ScoredClaim } from '@/server/modules/charities/transparency/score'

/**
 * Zakat labelling (§26).
 *
 * The single most important assertion in this file: `ACCEPTS_ZAKAT = YES` on its
 * own never produces anything that reads as religious verification, no matter
 * how well-evidenced the rest of the charity is.
 */

const RECENT = new Date('2026-06-01T00:00:00.000Z')

function claim(
  type: ScoredClaim['type'],
  overrides: Partial<ScoredClaim> = {},
): ScoredClaim {
  return {
    type,
    value: 'YES',
    status: 'SELF_REPORTED',
    source: { sourceType: 'OFFICIAL_WEBSITE', publishedAt: RECENT, retrievedAt: RECENT },
    ...overrides,
  }
}

describe('no information', () => {
  it('reports UNKNOWN with no claims at all', () => {
    const result = deriveZakatStatus([])

    expect(result.status).toBe('UNKNOWN')
    // Unknown must not read as a negative statement about the charity.
    expect(result.explanation).toContain('niet dat de organisatie geen Zakat accepteert')
  })

  it('reports UNKNOWN when the claim exists but is unknown', () => {
    expect(deriveZakatStatus([claim('ACCEPTS_ZAKAT', { value: 'UNKNOWN' })]).status).toBe(
      'UNKNOWN',
    )
  })

  it('is unaffected by unrelated evidence, however strong', () => {
    // A perfect registry entry says nothing about Zakat policy.
    const result = deriveZakatStatus([
      claim('REGISTERED_ENTITY', {
        status: 'VERIFIED',
        source: { sourceType: 'GOVERNMENT_REGISTER', publishedAt: RECENT, retrievedAt: RECENT },
      }),
      claim('ANNUAL_REPORT_PUBLISHED', { status: 'VERIFIED' }),
    ])

    expect(result.status).toBe('UNKNOWN')
  })
})

describe('self-declared', () => {
  it('reports SELF_DECLARED when the charity says so on its own site', () => {
    const result = deriveZakatStatus([claim('ACCEPTS_ZAKAT')])

    expect(result.status).toBe('SELF_DECLARED')
    expect(result.label).toBe('Zegt Zakat te accepteren')
  })

  it('says plainly that this is not independently checked', () => {
    const result = deriveZakatStatus([claim('ACCEPTS_ZAKAT')])

    expect(result.explanation).toContain('niet onafhankelijk')
    expect(result.explanation).toContain('geen religieuze goedkeuring')
  })

  it('does not reach verification even when the claim is marked VERIFIED', () => {
    // Verifying "the charity says it accepts Zakat" verifies the statement, not
    // the religious suitability of the destination.
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT', {
        status: 'VERIFIED',
        source: { sourceType: 'GOVERNMENT_REGISTER', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.status).toBe('SELF_DECLARED')
    expect(result.status).not.toBe('INDEPENDENTLY_VERIFIED')
  })
})

describe('published policy', () => {
  it('climbs to POLICY_PUBLISHED with a sourced policy claim', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_POLICY_PUBLISHED', {
        source: { sourceType: 'ZAKAT_POLICY', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.status).toBe('POLICY_PUBLISHED')
    expect(result.basedOn).toContain('ZAKAT_POLICY_PUBLISHED')
  })

  it('states that only the existence of the policy was established', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_POLICY_PUBLISHED', {
        source: { sourceType: 'ZAKAT_POLICY', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.explanation).toContain('niet dat het religieus juist is')
  })

  it('ignores a policy claim with no source', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_POLICY_PUBLISHED', { source: null }),
    ])

    expect(result.status).toBe('SELF_DECLARED')
  })

  it('climbs to ALLOCATION_DESCRIBED when the spend is described', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_POLICY_PUBLISHED'),
      claim('ZAKAT_ALLOCATION_DESCRIBED'),
    ])

    expect(result.status).toBe('ALLOCATION_DESCRIBED')
    expect(result.explanation).toContain('geleerde')
  })
})

describe('independent verification', () => {
  it('requires a verified claim backed by an independent source', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', {
        status: 'VERIFIED',
        source: { sourceType: 'INDEPENDENT_REVIEW', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.status).toBe('INDEPENDENTLY_VERIFIED')
  })

  it('refuses when the "independent" source is the charity’s own website', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', {
        status: 'VERIFIED',
        source: { sourceType: 'OFFICIAL_WEBSITE', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    // The whole point of the level is independence from the organisation.
    expect(result.status).toBe('SELF_DECLARED')
  })

  it('refuses when the claim is only self-reported', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', {
        status: 'SELF_REPORTED',
        source: { sourceType: 'INDEPENDENT_REVIEW', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.status).toBe('SELF_DECLARED')
  })

  it('still frames the top level as documentation, not a ruling', () => {
    const result = deriveZakatStatus([
      claim('ACCEPTS_ZAKAT'),
      claim('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', {
        status: 'VERIFIED',
        source: { sourceType: 'GOVERNMENT_REGISTER', publishedAt: RECENT, retrievedAt: RECENT },
      }),
    ])

    expect(result.explanation).toContain('geen religieus oordeel')
  })
})

describe('explicit refusal', () => {
  it('reports DOES_NOT_ACCEPT for a sourced NO', () => {
    const result = deriveZakatStatus([claim('ACCEPTS_ZAKAT', { value: 'NO' })])

    expect(result.status).toBe('DOES_NOT_ACCEPT')
  })
})

describe('label safety', () => {
  it('never produces a label implying religious approval', () => {
    const forbidden = ['geverifieerd als zakat-bestemming', 'islamitisch geverifieerd', 'halal']

    const allStates = [
      deriveZakatStatus([]),
      deriveZakatStatus([claim('ACCEPTS_ZAKAT')]),
      deriveZakatStatus([claim('ACCEPTS_ZAKAT'), claim('ZAKAT_POLICY_PUBLISHED')]),
      deriveZakatStatus([
        claim('ACCEPTS_ZAKAT'),
        claim('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', {
          status: 'VERIFIED',
          source: { sourceType: 'GOVERNMENT_REGISTER', publishedAt: RECENT, retrievedAt: RECENT },
        }),
      ]),
    ]

    for (const state of allStates) {
      const label = state.label.toLowerCase()
      for (const phrase of forbidden) expect(label).not.toContain(phrase)
    }
  })
})
