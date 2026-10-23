import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The admin boundary (§21, §27).
 *
 * `requireAdmin()` is what stands between a signed-in ordinary user and every
 * charity mutation — claims, sources, verification, score recalculation. The
 * proxy does not gate `/api`, so if this check were wrong, any account could
 * rewrite the evidence behind a transparency score.
 *
 * The session and the database are mocked so the guard itself is under test,
 * rather than NextAuth or Prisma.
 */

const authMock = vi.hoisted(() => vi.fn())
const findUniqueMock = vi.hoisted(() => vi.fn())

vi.mock('@/server/auth', () => ({ auth: authMock }))
vi.mock('@/server/db/prisma', () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}))

const { requireActor, requireAdmin, getActor } = await import('@/server/auth/actor')
const { ForbiddenError, UnauthenticatedError } = await import('@/lib/errors')

function userRow(role: 'USER' | 'ADMIN') {
  return {
    id: 'user-1',
    email: 'someone@example.com',
    name: 'Someone',
    role,
    locale: 'nl',
    timezone: 'Europe/Brussels',
    onboardedAt: new Date(),
    deletedAt: null,
    sessionVersion: 0,
    subscription: { plan: 'FREE', status: 'ACTIVE' },
    zakatProfile: { defaultCurrency: 'EUR' },
    householdMemberships: [],
  }
}

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // `getActor` is React-cached; a fresh module registry per test avoids the
    // cache carrying a previous user across cases.
    vi.resetModules()
  })

  it('rejects an anonymous caller', async () => {
    authMock.mockResolvedValue(null)

    await expect(requireAdmin()).rejects.toThrow(UnauthenticatedError)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('rejects a signed-in user without the admin role', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    findUniqueMock.mockResolvedValue(userRow('USER'))

    // Being authenticated is not being authorised.
    await expect(requireAdmin()).rejects.toThrow(ForbiddenError)
  })

  it('returns a 403, not a 404, for a non-admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    findUniqueMock.mockResolvedValue(userRow('USER'))

    try {
      await requireAdmin()
      expect.unreachable('should have thrown')
    } catch (error) {
      // Unlike per-record ownership, the existence of the admin surface is not
      // a secret — hiding it would only obscure the real failure.
      expect((error as InstanceType<typeof ForbiddenError>).status).toBe(403)
    }
  })

  it('admits an admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    findUniqueMock.mockResolvedValue(userRow('ADMIN'))

    const actor = await requireAdmin()
    expect(actor.role).toBe('ADMIN')
  })

  it('rejects a soft-deleted admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    findUniqueMock.mockResolvedValue({ ...userRow('ADMIN'), deletedAt: new Date() })

    // A deactivated account keeps a valid JWT until it expires; the actor
    // lookup is what actually revokes it.
    await expect(requireAdmin()).rejects.toThrow(UnauthenticatedError)
  })
})

describe('requireActor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('admits an ordinary signed-in user', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    findUniqueMock.mockResolvedValue(userRow('USER'))

    const actor = await requireActor()
    expect(actor.userId).toBe('user-1')
    expect(actor.role).toBe('USER')
  })

  it('returns null from getActor when signed out', async () => {
    authMock.mockResolvedValue(null)
    expect(await getActor()).toBeNull()
  })
})

describe('sessie-intrekking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('weigert een sessie met een oudere sessieversie', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', sessionVersion: 0 } })
    findUniqueMock.mockResolvedValue({ ...userRow('USER'), sessionVersion: 1 })

    await expect(getActor()).resolves.toBeNull()
    await expect(requireActor()).rejects.toThrow(UnauthenticatedError)
  })

  it('aanvaardt de sessie met de huidige versie', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', sessionVersion: 3 } })
    findUniqueMock.mockResolvedValue({ ...userRow('USER'), sessionVersion: 3 })

    await expect(getActor()).resolves.toMatchObject({ userId: 'user-1' })
  })
})
