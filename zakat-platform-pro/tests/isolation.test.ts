import { describe, expect, it } from 'vitest'

import type { Actor } from '@/server/auth/actor'
import {
  assertCanTagHousehold,
  assertHouseholdRole,
  assertOwner,
  assertReadable,
  householdMembership,
  ownedBy,
  readableHouseholdIds,
  visibleTo,
} from '@/server/auth/scope'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

/**
 * User isolation (§53). These assertions encode the security model itself:
 * if one of them starts failing, financial data has become reachable across
 * account boundaries.
 */

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: 'user-a',
    email: 'a@example.com',
    name: 'A',
    role: 'USER',
    plan: 'FREE',
    locale: 'nl',
    timezone: 'Europe/Brussels',
    defaultCurrency: 'EUR',
    onboarded: true,
    households: [],
    ...overrides,
  }
}

const withHousehold = actor({
  households: [{ householdId: 'hh-1', role: 'MEMBER', sharesFinancials: true }],
})

describe('ownedBy', () => {
  it('scopes strictly to the actor', () => {
    expect(ownedBy(actor())).toEqual({ userId: 'user-a' })
  })

  it('ignores household membership entirely', () => {
    // Writes must never widen because someone joined a household.
    expect(ownedBy(withHousehold)).toEqual({ userId: 'user-a' })
  })
})

describe('visibleTo', () => {
  it('matches own rows and rows shared into my households', () => {
    expect(visibleTo(withHousehold)).toEqual({
      OR: [{ userId: 'user-a' }, { householdId: { in: ['hh-1'] } }],
    })
  })

  it('cannot match anything by household when I am in none', () => {
    const filter = visibleTo(actor())
    expect(filter.OR[1].householdId.in).toEqual([])
    // An empty `in` matches no rows in Prisma, so this is a closed filter.
    expect(readableHouseholdIds(actor())).toHaveLength(0)
  })
})

describe('assertOwner', () => {
  it('returns the record for its owner', () => {
    const record = { userId: 'user-a', householdId: null }
    expect(assertOwner(actor(), record)).toBe(record)
  })

  it('reports 404, not 403, for another user’s record', () => {
    try {
      assertOwner(actor(), { userId: 'user-b', householdId: null })
      expect.unreachable('should have thrown')
    } catch (error) {
      // 403 would confirm the id exists — that is the leak we are avoiding.
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as NotFoundError).status).toBe(404)
    }
  })

  it('does not let a shared household grant write access', () => {
    expect(() => assertOwner(withHousehold, { userId: 'user-b', householdId: 'hh-1' })).toThrow(
      NotFoundError,
    )
  })

  it('rejects a missing record', () => {
    expect(() => assertOwner(actor(), null)).toThrow(NotFoundError)
  })
})

describe('assertReadable', () => {
  it('allows the owner', () => {
    expect(assertReadable(actor(), { userId: 'user-a' })).toBeTruthy()
  })

  it('allows a household member for a row tagged into that household', () => {
    expect(assertReadable(withHousehold, { userId: 'user-b', householdId: 'hh-1' })).toBeTruthy()
  })

  it('blocks a row tagged into a household I am not in', () => {
    expect(() =>
      assertReadable(withHousehold, { userId: 'user-b', householdId: 'hh-2' }),
    ).toThrow(NotFoundError)
  })

  it('blocks an untagged row belonging to somebody else', () => {
    expect(() =>
      assertReadable(withHousehold, { userId: 'user-b', householdId: null }),
    ).toThrow(NotFoundError)
  })
})

describe('assertHouseholdRole', () => {
  const admin = actor({
    households: [{ householdId: 'hh-1', role: 'ADMIN', sharesFinancials: true }],
  })
  const viewer = actor({
    households: [{ householdId: 'hh-1', role: 'VIEWER', sharesFinancials: false }],
  })

  it('admits a higher role than required', () => {
    expect(assertHouseholdRole(admin, 'hh-1', 'MEMBER').role).toBe('ADMIN')
  })

  it('rejects a lower role', () => {
    expect(() => assertHouseholdRole(viewer, 'hh-1', 'ADMIN')).toThrow(ForbiddenError)
  })

  it('rejects a non-member with 404', () => {
    expect(() => assertHouseholdRole(actor(), 'hh-1', 'VIEWER')).toThrow(NotFoundError)
  })
})

describe('assertCanTagHousehold', () => {
  it('accepts null (a private row)', () => {
    expect(assertCanTagHousehold(actor(), null)).toBeNull()
  })

  it('accepts a household I share finances with', () => {
    expect(assertCanTagHousehold(withHousehold, 'hh-1')).toBe('hh-1')
  })

  it('rejects a household I have not opted into sharing with', () => {
    const optedOut = actor({
      households: [{ householdId: 'hh-1', role: 'MEMBER', sharesFinancials: false }],
    })
    expect(() => assertCanTagHousehold(optedOut, 'hh-1')).toThrow(ForbiddenError)
  })

  it('rejects a household I do not belong to', () => {
    expect(() => assertCanTagHousehold(withHousehold, 'hh-9')).toThrow(NotFoundError)
  })
})

describe('householdMembership', () => {
  it('returns null for a household I am not in', () => {
    expect(householdMembership(withHousehold, 'hh-9')).toBeNull()
  })
})
