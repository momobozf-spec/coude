import { afterAll, describe, expect, it } from 'vitest'

import {
  actorFor,
  cleanup,
  createTestUser,
  disconnect,
  hasTestDatabase,
  testPrisma,
} from './setup'

/**
 * Privacy operations against a real database.
 *
 * The unit suite pins the *shape* of these services by reading source. This
 * pins the behaviour: what actually disappears, what actually survives, and
 * whether running the policy twice is safe.
 */

const describeIf = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn('[integration] TEST_DATABASE_URL is not set — privacy tests are SKIPPED, not passing.')
}

describeIf('privacy (integration)', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function seedMember(email: string, plan: 'FREE' | 'PREMIUM' = 'FREE') {
    const prisma = testPrisma()
    const user = await createTestUser(email, plan)
    created.push(user.id)

    const habit = await prisma.habit.create({
      data: { userId: user.id, name: 'Morning adhkar', type: 'BOOLEAN' },
    })

    await prisma.habitLog.create({
      data: { userId: user.id, habitId: habit.id, localDate: new Date('2026-08-01'), status: 'COMPLETED' },
    })
    await prisma.prayerLog.create({
      data: { userId: user.id, date: new Date('2026-08-01'), prayer: 'FAJR', status: 'ON_TIME' },
    })
    await prisma.dailyReflection.create({
      data: { userId: user.id, localDate: new Date('2026-08-01'), gratitude: 'A private sentence' },
    })
    await prisma.task.create({ data: { userId: user.id, title: 'Call mum' } })

    return { user, habit }
  }

  describe('export', () => {
    it('returns the member’s own rows and nobody else’s', async () => {
      const { buildDataExport } = await import('@/server/modules/privacy/export.service')

      const mine = await seedMember(`export-mine-${Date.now()}@test.local`)
      const theirs = await seedMember(`export-theirs-${Date.now()}@test.local`)

      const data = await buildDataExport(actorFor(mine.user.id, mine.user.email))
      const serialised = JSON.stringify(data)

      expect(data.exportVersion).toBeGreaterThan(0)
      expect(serialised).toContain('Call mum')
      // The other member's habit is identically named; their id must not appear.
      expect(serialised).not.toContain(theirs.user.id)
      expect(serialised).not.toContain(theirs.user.email)
    })

    it('contains no password hash or session token', async () => {
      const prisma = testPrisma()
      const { buildDataExport } = await import('@/server/modules/privacy/export.service')

      const { user } = await seedMember(`export-secrets-${Date.now()}@test.local`)

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: '$2a$10$UNIQUEHASHVALUE1234567890' },
      })
      await prisma.session.create({
        data: {
          userId: user.id,
          sessionToken: 'UNIQUESESSIONTOKEN1234567890',
          expires: new Date(Date.now() + 86_400_000),
        },
      })

      const serialised = JSON.stringify(
        await buildDataExport(actorFor(user.id, user.email)),
      )

      expect(serialised).not.toContain('$2a$10$UNIQUEHASHVALUE1234567890')
      expect(serialised).not.toContain('UNIQUESESSIONTOKEN1234567890')
    })

    it('refuses a second export inside the cooldown', async () => {
      const { buildDataExport, getExportEligibility } = await import(
        '@/server/modules/privacy/export.service'
      )

      const { user } = await seedMember(`export-limit-${Date.now()}@test.local`)
      const actor = actorFor(user.id, user.email)

      await buildDataExport(actor)

      await expect(buildDataExport(actor)).rejects.toMatchObject({ code: 'RATE_LIMITED' })

      const eligibility = await getExportEligibility(actor)
      expect(eligibility.allowed).toBe(false)
      expect(eligibility.retryAfterHours).toBeGreaterThan(0)
    })
  })

  describe('clear activity', () => {
    it('removes tracked data and keeps the account', async () => {
      const prisma = testPrisma()
      const { clearActivity } = await import('@/server/modules/privacy/deletion.service')

      const { user } = await seedMember(`clear-${Date.now()}@test.local`)

      const result = await clearActivity(actorFor(user.id, user.email))
      expect(result.total).toBeGreaterThan(0)

      expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.prayerLog.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.dailyReflection.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.task.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.habit.count({ where: { userId: user.id } })).toBe(0)

      // Clearing history is not leaving.
      expect(await prisma.user.count({ where: { id: user.id } })).toBe(1)
      expect(await prisma.userPreference.count({ where: { userId: user.id } })).toBe(1)
      expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1)
    })

    it('touches nobody else’s data', async () => {
      const prisma = testPrisma()
      const { clearActivity } = await import('@/server/modules/privacy/deletion.service')

      const mine = await seedMember(`clear-mine-${Date.now()}@test.local`)
      const theirs = await seedMember(`clear-theirs-${Date.now()}@test.local`)

      await clearActivity(actorFor(mine.user.id, mine.user.email))

      expect(await prisma.task.count({ where: { userId: theirs.user.id } })).toBe(1)
      expect(await prisma.prayerLog.count({ where: { userId: theirs.user.id } })).toBe(1)
    })
  })

  describe('account deletion', () => {
    it('refuses while a paid subscription is live', async () => {
      const { requestAccountDeletion } = await import('@/server/modules/privacy/deletion.service')

      const { user } = await seedMember(`delete-paid-${Date.now()}@test.local`, 'PREMIUM')

      await expect(
        requestAccountDeletion(actorFor(user.id, user.email, 'PREMIUM'), 'DELETE'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      const after = await testPrisma().user.findUniqueOrThrow({
        where: { id: user.id },
        select: { deletionStatus: true },
      })
      expect(after.deletionStatus).toBe('BLOCKED_BILLING')
    })

    it('requires the typed confirmation', async () => {
      const { requestAccountDeletion } = await import('@/server/modules/privacy/deletion.service')

      const { user } = await seedMember(`delete-confirm-${Date.now()}@test.local`)

      await expect(
        requestAccountDeletion(actorFor(user.id, user.email), 'yes please'),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('revokes every session the moment deletion is requested', async () => {
      const prisma = testPrisma()
      const { requestAccountDeletion } = await import('@/server/modules/privacy/deletion.service')

      const { user } = await seedMember(`delete-sessions-${Date.now()}@test.local`)

      await prisma.session.create({
        data: {
          userId: user.id,
          sessionToken: `revoke-${user.id}`,
          expires: new Date(Date.now() + 86_400_000),
        },
      })

      await requestAccountDeletion(actorFor(user.id, user.email), 'DELETE')

      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
    })

    it('does nothing while the grace window is open', async () => {
      const { completeAccountDeletion, requestAccountDeletion } = await import(
        '@/server/modules/privacy/deletion.service'
      )

      const { user } = await seedMember(`delete-grace-${Date.now()}@test.local`)
      await requestAccountDeletion(actorFor(user.id, user.email), 'DELETE')

      const result = await completeAccountDeletion(user.id)

      expect(result.completed).toBe(false)
      expect(result.reason).toBe('GRACE_PERIOD')
      expect(await testPrisma().task.count({ where: { userId: user.id } })).toBe(1)
    })

    it('can be withdrawn', async () => {
      const { cancelAccountDeletion, requestAccountDeletion } = await import(
        '@/server/modules/privacy/deletion.service'
      )

      const { user } = await seedMember(`delete-cancel-${Date.now()}@test.local`)
      const actor = actorFor(user.id, user.email)

      await requestAccountDeletion(actor, 'DELETE')
      const state = await cancelAccountDeletion(actor)

      expect(state.status).toBe('NONE')
      expect(state.requestedAt).toBeNull()
    })

    it('executes the policy: deletes content, keeps the retained records', async () => {
      const prisma = testPrisma()
      const { completeAccountDeletion, requestAccountDeletion } = await import(
        '@/server/modules/privacy/deletion.service'
      )

      const { user } = await seedMember(`delete-run-${Date.now()}@test.local`)
      const actor = actorFor(user.id, user.email)

      await prisma.analyticsEvent.create({
        data: { userId: user.id, name: 'MY_DAY_OPENED', properties: { taskCount: 1 } },
      })

      await requestAccountDeletion(actor, 'DELETE')
      const result = await completeAccountDeletion(user.id, { force: true })

      expect(result.completed).toBe(true)

      // DELETE
      for (const count of [
        prisma.task.count({ where: { userId: user.id } }),
        prisma.habit.count({ where: { userId: user.id } }),
        prisma.habitLog.count({ where: { userId: user.id } }),
        prisma.prayerLog.count({ where: { userId: user.id } }),
        prisma.dailyReflection.count({ where: { userId: user.id } }),
        prisma.userPreference.count({ where: { userId: user.id } }),
        prisma.session.count({ where: { userId: user.id } }),
      ]) {
        expect(await count).toBe(0)
      }

      // ANONYMIZE — the row survives, the link does not.
      expect(await prisma.analyticsEvent.count({ where: { userId: user.id } })).toBe(0)
      expect(
        await prisma.analyticsEvent.count({ where: { userId: null, name: 'MY_DAY_OPENED' } }),
      ).toBeGreaterThan(0)

      // RETAIN — the proof that the deletion happened.
      expect(
        await prisma.auditLog.count({ where: { entityId: user.id, action: 'ACCOUNT_DELETED' } }),
      ).toBe(1)

      // The account row is scrubbed, not removed.
      const scrubbed = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          email: true,
          name: true,
          passwordHash: true,
          deletionStatus: true,
          anonymizedAt: true,
          deletedAt: true,
        },
      })

      expect(scrubbed.deletionStatus).toBe('COMPLETED')
      expect(scrubbed.name).toBeNull()
      expect(scrubbed.passwordHash).toBeNull()
      expect(scrubbed.email).toMatch(/^deleted\+[0-9a-f]{32}@deleted\.invalid$/)
      expect(scrubbed.anonymizedAt).not.toBeNull()
      expect(scrubbed.deletedAt).not.toBeNull()
    })

    it('is idempotent — a retry after a partial failure is safe', async () => {
      const { completeAccountDeletion, requestAccountDeletion } = await import(
        '@/server/modules/privacy/deletion.service'
      )

      const { user } = await seedMember(`delete-twice-${Date.now()}@test.local`)
      await requestAccountDeletion(actorFor(user.id, user.email), 'DELETE')

      const first = await completeAccountDeletion(user.id, { force: true })
      const second = await completeAccountDeletion(user.id, { force: true })

      expect(first.completed).toBe(true)
      expect(second.completed).toBe(false)
      expect(second.reason).toBe('ALREADY_COMPLETED')

      // Exactly one audit entry — not one per attempt.
      expect(
        await testPrisma().auditLog.count({
          where: { entityId: user.id, action: 'ACCOUNT_DELETED' },
        }),
      ).toBe(1)
    })

    it('lists an account as due only once the window has passed', async () => {
      const prisma = testPrisma()
      const { listDueDeletions, requestAccountDeletion, DELETION_GRACE_DAYS } = await import(
        '@/server/modules/privacy/deletion.service'
      )

      const { user } = await seedMember(`delete-due-${Date.now()}@test.local`)
      await requestAccountDeletion(actorFor(user.id, user.email), 'DELETE')

      expect(await listDueDeletions()).not.toContain(user.id)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletionRequestedAt: new Date(
            Date.now() - (DELETION_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000,
          ),
        },
      })

      expect(await listDueDeletions()).toContain(user.id)
    })
  })
})
