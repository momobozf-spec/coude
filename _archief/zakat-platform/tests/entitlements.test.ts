import { describe, expect, it } from 'vitest'

import { FEATURES, LIMITS, PLANS, PLAN_ORDER, lowestPlanWithFeature } from '@/config/plans'
import {
  assertFeature,
  assertWithinLimit,
  canUseFeature,
  entitlementSnapshot,
  getLimit,
  hasRemaining,
  nextPlanForLimit,
  remaining,
} from '@/server/services/entitlements'
import { EntitlementError } from '@/lib/errors'

describe('plan table', () => {
  it('defines every limit for every plan', () => {
    for (const plan of PLAN_ORDER) {
      for (const key of LIMITS) {
        expect(PLANS[plan].limits[key]).toBeDefined()
      }
    }
  })

  it('never lists a feature that is not declared', () => {
    for (const plan of PLAN_ORDER) {
      for (const feature of PLANS[plan].features) {
        expect(FEATURES).toContain(feature)
      }
    }
  })

  it('is monotonic — a higher tier never removes a feature', () => {
    const tiers = ['FREE', 'PLUS', 'FAMILY', 'ORGANIZATION'] as const
    for (let i = 1; i < tiers.length; i += 1) {
      const lower = PLANS[tiers[i - 1]!].features
      const higher = PLANS[tiers[i]!].features
      for (const feature of lower) {
        expect(higher).toContain(feature)
      }
    }
  })

  it('is monotonic on limits too', () => {
    const tiers = ['FREE', 'PLUS', 'FAMILY', 'ORGANIZATION'] as const
    for (const key of LIMITS) {
      for (let i = 1; i < tiers.length; i += 1) {
        const lower = PLANS[tiers[i - 1]!].limits[key]
        const higher = PLANS[tiers[i]!].limits[key]
        if (lower === null) {
          expect(higher).toBeNull()
        } else if (higher !== null) {
          expect(higher).toBeGreaterThanOrEqual(lower)
        }
      }
    }
  })
})

describe('canUseFeature', () => {
  it('gates premium features on the free plan', () => {
    expect(canUseFeature({ plan: 'FREE' }, 'MULTI_CURRENCY')).toBe(false)
    expect(canUseFeature({ plan: 'PLUS' }, 'MULTI_CURRENCY')).toBe(true)
  })

  it('keeps household out of Plus but in Family', () => {
    expect(canUseFeature({ plan: 'PLUS' }, 'HOUSEHOLD')).toBe(false)
    expect(canUseFeature({ plan: 'FAMILY' }, 'HOUSEHOLD')).toBe(true)
    expect(canUseFeature({ plan: 'ORGANIZATION' }, 'HOUSEHOLD')).toBe(true)
  })
})

describe('assertFeature', () => {
  it('passes when entitled', () => {
    expect(() => assertFeature({ plan: 'PLUS' }, 'YEARLY_REPORTS')).not.toThrow()
  })

  it('throws a 402 naming the plan that unlocks it', () => {
    try {
      assertFeature({ plan: 'FREE' }, 'HOUSEHOLD')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError)
      const entitlement = error as EntitlementError
      expect(entitlement.status).toBe(402)
      expect(entitlement.feature).toBe('HOUSEHOLD')
      expect(entitlement.requiredPlan).toBe('FAMILY')
    }
  })
})

describe('limits', () => {
  it('treats null as unlimited', () => {
    expect(getLimit({ plan: 'PLUS' }, 'assets')).toBeNull()
    expect(hasRemaining({ plan: 'PLUS' }, 'assets', 10_000)).toBe(true)
    expect(remaining({ plan: 'PLUS' }, 'assets', 10_000)).toBeNull()
  })

  it('allows exactly up to the limit', () => {
    // FREE allows one calculation per year.
    expect(hasRemaining({ plan: 'FREE' }, 'calculationsPerYear', 0)).toBe(true)
    expect(hasRemaining({ plan: 'FREE' }, 'calculationsPerYear', 1)).toBe(false)
    expect(remaining({ plan: 'FREE' }, 'calculationsPerYear', 1)).toBe(0)
  })

  it('throws once the allowance is used up', () => {
    expect(() => assertWithinLimit({ plan: 'FREE' }, 'assets', 9)).not.toThrow()
    expect(() => assertWithinLimit({ plan: 'FREE' }, 'assets', 10)).toThrow(EntitlementError)
  })

  it('points at the cheapest plan that raises the limit', () => {
    expect(nextPlanForLimit({ plan: 'FREE' }, 'assets')).toBe('PLUS')
    expect(nextPlanForLimit({ plan: 'FREE' }, 'householdMembers')).toBe('FAMILY')
    expect(nextPlanForLimit({ plan: 'ORGANIZATION' }, 'assets')).toBeNull()
  })
})

describe('lowestPlanWithFeature', () => {
  it('finds the cheapest tier per feature', () => {
    expect(lowestPlanWithFeature('AI_ASSISTANT')).toBe('PLUS')
    expect(lowestPlanWithFeature('HOUSEHOLD_SHARED_DASHBOARD')).toBe('FAMILY')
    expect(lowestPlanWithFeature('ORGANIZATION_TEAM')).toBe('ORGANIZATION')
  })
})

describe('entitlementSnapshot', () => {
  it('reports every feature as an explicit boolean', () => {
    const snapshot = entitlementSnapshot({ plan: 'FREE' })
    expect(Object.keys(snapshot.features).sort()).toEqual([...FEATURES].sort())
    expect(Object.values(snapshot.features).every((v) => v === false)).toBe(true)
  })

  it('does not leak the plan table by reference', () => {
    const snapshot = entitlementSnapshot({ plan: 'PLUS' })
    snapshot.limits.assets = 1
    expect(PLANS.PLUS.limits.assets).toBeNull()
  })
})
