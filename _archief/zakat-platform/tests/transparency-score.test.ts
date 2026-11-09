import { describe, expect, it } from 'vitest'

import {
  calculateTransparencyScore,
  type ScoredClaim,
} from '@/server/modules/charities/transparency/score'
import {
  MINIMUM_MEANINGFUL_COVERAGE,
  TOTAL_FACTOR_WEIGHT,
  TRANSPARENCY_FACTORS,
  TRANSPARENCY_SCORE_VERSION,
} from '@/server/modules/charities/transparency/factors'

/**
 * The transparency score (§24).
 *
 * The properties that matter most here are not the exact numbers but the rules
 * they encode: unknown is not negative, self-reported is not verified, and stale
 * evidence cannot look like fresh evidence.
 */

const NOW = new Date('2026-08-08T00:00:00.000Z')
const RECENT = new Date('2026-06-01T00:00:00.000Z')
const OLD = new Date('2022-01-01T00:00:00.000Z')

function claim(overrides: Partial<ScoredClaim> & Pick<ScoredClaim, 'type'>): ScoredClaim {
  return {
    value: 'YES',
    status: 'VERIFIED',
    source: {
      sourceType: 'GOVERNMENT_REGISTER',
      publishedAt: RECENT,
      retrievedAt: RECENT,
      validUntil: null,
    },
    ...overrides,
  }
}

/** Every factor, verified, independent source, fresh. */
function perfectClaims(): ScoredClaim[] {
  return TRANSPARENCY_FACTORS.map((f) => claim({ type: f.claimType }))
}

describe('all factors present', () => {
  it('scores 100 with full coverage', () => {
    const result = calculateTransparencyScore({ claims: perfectClaims(), now: NOW })

    expect(result.score).toBe(100)
    expect(result.coverage).toBe(100)
    expect(result.hasSufficientCoverage).toBe(true)
    expect(result.assessablePoints).toBe(TOTAL_FACTOR_WEIGHT)
    expect(result.warnings).toHaveLength(0)
  })

  it('emits one component per factor, each with a reason', () => {
    const result = calculateTransparencyScore({ claims: perfectClaims(), now: NOW })

    expect(result.components).toHaveLength(TRANSPARENCY_FACTORS.length)
    for (const component of result.components) {
      expect(component.reason.length).toBeGreaterThan(0)
      expect(component.label.length).toBeGreaterThan(0)
    }
  })

  it('stamps the version that produced it', () => {
    const result = calculateTransparencyScore({ claims: perfectClaims(), now: NOW })
    expect(result.version).toBe(TRANSPARENCY_SCORE_VERSION)
    expect(result.calculatedAt).toEqual(NOW)
  })
})

describe('unknown is not negative', () => {
  it('excludes an unknown factor from the denominator', () => {
    const claims = [claim({ type: 'REGISTERED_ENTITY' })]
    const result = calculateTransparencyScore({ claims, now: NOW })

    // One verified factor out of one assessed → 100 of what is known…
    expect(result.score).toBe(100)
    // …but coverage exposes that almost nothing was checked.
    expect(result.coverage).toBeLessThan(MINIMUM_MEANINGFUL_COVERAGE)
    expect(result.hasSufficientCoverage).toBe(false)
  })

  it('warns when coverage is too low to be meaningful', () => {
    const result = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY' })],
      now: NOW,
    })

    expect(result.warnings.join(' ')).toContain('onderzocht')
  })

  it('lists every unresearched factor', () => {
    const result = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY' })],
      now: NOW,
    })

    expect(result.missingFactors).toHaveLength(TRANSPARENCY_FACTORS.length - 1)
    expect(result.missingFactors.map((f) => f.claimType)).not.toContain('REGISTERED_ENTITY')
  })

  it('returns a null score when nothing at all is known', () => {
    const result = calculateTransparencyScore({ claims: [], now: NOW })

    // Not zero: zero would read as "we checked and it is bad".
    expect(result.score).toBeNull()
    expect(result.coverage).toBe(0)
    expect(result.warnings.join(' ')).toContain('geen enkele factor')
  })

  it('treats an explicit UNKNOWN claim exactly like a missing one', () => {
    const withUnknown = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY', value: 'UNKNOWN' })],
      now: NOW,
    })
    const withNothing = calculateTransparencyScore({ claims: [], now: NOW })

    expect(withUnknown.score).toBe(withNothing.score)
    expect(withUnknown.coverage).toBe(withNothing.coverage)
  })
})

describe('explicit NO', () => {
  it('counts towards the denominator and earns nothing', () => {
    const claims = [
      claim({ type: 'REGISTERED_ENTITY' }),
      claim({ type: 'ANNUAL_REPORT_PUBLISHED', value: 'NO' }),
    ]
    const result = calculateTransparencyScore({ claims, now: NOW })

    // 20 earned of 35 assessable.
    expect(result.assessablePoints).toBe(35)
    expect(result.earnedPoints).toBe(20)
    expect(result.score).toBe(57)
  })

  it('scores lower than the same charity with the factor unknown', () => {
    const withNo = calculateTransparencyScore({
      claims: [
        claim({ type: 'REGISTERED_ENTITY' }),
        claim({ type: 'ANNUAL_REPORT_PUBLISHED', value: 'NO' }),
      ],
      now: NOW,
    })
    const withUnknown = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY' })],
      now: NOW,
    })

    // Checking and finding nothing is worse than not having checked — but the
    // coverage figure is what tells the user which situation they are in.
    expect(withNo.score!).toBeLessThan(withUnknown.score!)
    expect(withNo.coverage).toBeGreaterThan(withUnknown.coverage)
  })
})

describe('evidence status', () => {
  it('ranks verified above self-reported above unverified', () => {
    const score = (status: ScoredClaim['status']) =>
      calculateTransparencyScore({
        claims: [claim({ type: 'REGISTERED_ENTITY', status })],
        now: NOW,
      }).earnedPoints

    expect(score('VERIFIED')).toBeGreaterThan(score('SELF_REPORTED'))
    expect(score('SELF_REPORTED')).toBeGreaterThan(score('UNVERIFIED'))
  })

  it('gives a disputed claim nothing, with a warning', () => {
    const result = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY', status: 'DISPUTED' })],
      now: NOW,
    })

    expect(result.earnedPoints).toBe(0)
    expect(result.warnings.join(' ')).toContain('betwist')
    // Still assessed: a disputed claim is a researched factor.
    expect(result.assessablePoints).toBe(20)
  })

  it('penalises a claim with no source at all', () => {
    const withSource = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY' })],
      now: NOW,
    }).earnedPoints

    const withoutSource = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY', source: null })],
      now: NOW,
    }).earnedPoints

    expect(withoutSource).toBeLessThan(withSource)
  })
})

describe('source reliability', () => {
  it('weights an independent register above the charity’s own website', () => {
    const official = calculateTransparencyScore({
      claims: [
        claim({
          type: 'REGISTERED_ENTITY',
          source: { sourceType: 'GOVERNMENT_REGISTER', publishedAt: RECENT, retrievedAt: RECENT },
        }),
      ],
      now: NOW,
    }).earnedPoints

    const selfPublished = calculateTransparencyScore({
      claims: [
        claim({
          type: 'REGISTERED_ENTITY',
          source: { sourceType: 'OFFICIAL_WEBSITE', publishedAt: RECENT, retrievedAt: RECENT },
        }),
      ],
      now: NOW,
    }).earnedPoints

    expect(official).toBeGreaterThan(selfPublished)
  })

  it('records which source type backed each component', () => {
    const result = calculateTransparencyScore({
      claims: [claim({ type: 'REGISTERED_ENTITY' })],
      now: NOW,
    })

    const component = result.components.find((c) => c.claimType === 'REGISTERED_ENTITY')
    expect(component?.sourceType).toBe('GOVERNMENT_REGISTER')
  })
})

describe('freshness', () => {
  it('earns less from a stale source than a fresh one', () => {
    const fresh = calculateTransparencyScore({
      claims: [claim({ type: 'ANNUAL_REPORT_PUBLISHED' })],
      now: NOW,
    }).earnedPoints

    const stale = calculateTransparencyScore({
      claims: [
        claim({
          type: 'ANNUAL_REPORT_PUBLISHED',
          source: {
            sourceType: 'GOVERNMENT_REGISTER',
            publishedAt: new Date('2023-06-01T00:00:00Z'),
            retrievedAt: RECENT,
          },
        }),
      ],
      now: NOW,
    }).earnedPoints

    expect(stale).toBeLessThan(fresh)
  })

  it('earns almost nothing from an expired source, and says so', () => {
    const result = calculateTransparencyScore({
      claims: [
        claim({
          type: 'ANNUAL_REPORT_PUBLISHED',
          source: { sourceType: 'ANNUAL_REPORT', publishedAt: OLD, retrievedAt: OLD },
        }),
      ],
      now: NOW,
    })

    expect(result.components[1]?.freshness).toBe('EXPIRED')
    expect(result.warnings.join(' ')).toContain('verlopen')
  })

  it('honours an explicit validUntil in the past', () => {
    const result = calculateTransparencyScore({
      claims: [
        claim({
          type: 'REGISTERED_ENTITY',
          source: {
            sourceType: 'GOVERNMENT_REGISTER',
            publishedAt: RECENT,
            retrievedAt: RECENT,
            validUntil: new Date('2026-01-01T00:00:00Z'),
          },
        }),
      ],
      now: NOW,
    })

    expect(result.components[0]?.freshness).toBe('EXPIRED')
  })
})

describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const claims = perfectClaims()

    const a = calculateTransparencyScore({ claims, now: NOW })
    const b = calculateTransparencyScore({ claims, now: NOW })

    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not depend on the order claims arrive in', () => {
    const claims = perfectClaims()
    const reversed = [...claims].reverse()

    const a = calculateTransparencyScore({ claims, now: NOW })
    const b = calculateTransparencyScore({ claims: reversed, now: NOW })

    expect(a.score).toBe(b.score)
    expect(JSON.stringify(a.components)).toBe(JSON.stringify(b.components))
  })

  it('changes only when the inputs change', () => {
    const base = calculateTransparencyScore({ claims: perfectClaims(), now: NOW })

    const degraded = calculateTransparencyScore({
      claims: perfectClaims().map((c) =>
        c.type === 'REGISTERED_ENTITY' ? { ...c, status: 'SELF_REPORTED' as const } : c,
      ),
      now: NOW,
    })

    expect(degraded.score!).toBeLessThan(base.score!)
  })
})

describe('factor set integrity', () => {
  it('has weights that sum to the documented total', () => {
    expect(TOTAL_FACTOR_WEIGHT).toBe(100)
  })

  it('contains no subjective factor', () => {
    // Anything needing an opinion has no place in a verifiability score (§8).
    const forbidden = ['trustworthy', 'ethical', 'halal', 'impact_quality', 'recommended']
    for (const factor of TRANSPARENCY_FACTORS) {
      expect(forbidden).not.toContain(factor.claimType.toLowerCase())
    }
  })
})
