import { describe, expect, it } from 'vitest'

import {
  ENTITLEMENTS,
  hasEntitlement,
  limitsFor,
  requireEntitlement,
  withinLimit,
} from '@/server/services/entitlements'
import { EntitlementError } from '@/lib/errors'

const FREE = { plan: 'FREE' as const }
const PREMIUM = { plan: 'PREMIUM' as const }

describe('entitlements', () => {
  it('grants premium features only to premium members', () => {
    for (const feature of Object.keys(ENTITLEMENTS) as (keyof typeof ENTITLEMENTS)[]) {
      expect(hasEntitlement(PREMIUM, feature)).toBe(true)
      expect(hasEntitlement(FREE, feature)).toBe(false)
    }
  })

  it('throws EntitlementError for a free member', () => {
    expect(() => requireEntitlement(FREE, 'habits.unlimited')).toThrow(EntitlementError)
    expect(() => requireEntitlement(PREMIUM, 'habits.unlimited')).not.toThrow()
  })

  it('carries the feature name and a 402 status on the error', () => {
    try {
      requireEntitlement(FREE, 'assistant.generators')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError)
      const entitlementError = error as EntitlementError
      expect(entitlementError.feature).toBe('assistant.generators')
      expect(entitlementError.status).toBe(402)
    }
  })

  it('lets `unless` waive the check inside the free quota', () => {
    expect(() => requireEntitlement(FREE, 'habits.unlimited', { unless: true })).not.toThrow()
    expect(() => requireEntitlement(FREE, 'habits.unlimited', { unless: false })).toThrow()
  })
})

describe('plan limits', () => {
  it('caps free members and leaves premium unlimited', () => {
    expect(limitsFor(FREE).maxHabits).toBe(5)
    expect(limitsFor(PREMIUM).maxHabits).toBeNull()
  })

  it('allows counts strictly below the limit', () => {
    expect(withinLimit(0, 5)).toBe(true)
    expect(withinLimit(4, 5)).toBe(true)
    // Five habits exist; creating a sixth must be blocked.
    expect(withinLimit(5, 5)).toBe(false)
    expect(withinLimit(9999, null)).toBe(true)
  })
})
