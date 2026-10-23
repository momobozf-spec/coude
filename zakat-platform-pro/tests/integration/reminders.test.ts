import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createRuleSet, createTestUser, prisma, resetDatabase } from './setup'
import {
  cancelReminder,
  createReminder,
  getReminder,
  listReminders,
  setReminderStatus,
  updateReminder,
} from '@/server/modules/reminders/service'
import { processDueReminders } from '@/server/modules/reminders/processor'
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@/server/modules/notifications/service'
import { createAsset } from '@/server/modules/assets/service'
import {
  finalizeCalculation,
  getOrCreateDraft,
} from '@/server/modules/zakat/calculation-service'
import {
  NotificationNotFoundError,
  ReminderNotFoundError,
} from '@/server/modules/reminders/errors'
import { NotFoundError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'
import type { ReminderCreatePayload } from '@/modules/reminders/schemas'

/**
 * Reminders, notification generation and isolation against a real database
 * (§44, §45, §48).
 *
 * Every test pins an explicit `now`. Nothing reads the wall clock, so the suite
 * behaves identically whenever it runs (§55).
 */

const suite = hasDatabase ? describe : describe.skip

const BRUSSELS = 'Europe/Brussels'
const NOW = new Date('2026-06-15T12:00:00.000Z')

function reminderInput(overrides: Partial<ReminderCreatePayload> = {}): ReminderCreatePayload {
  return {
    type: 'CUSTOM',
    title: 'Herinnering',
    description: null,
    startAt: new Date('2026-06-20T07:00:00.000Z'),
    endAt: null,
    localTime: '09:00',
    timezone: BRUSSELS,
    recurrence: 'ONE_TIME',
    calendarMethod: 'GREGORIAN',
    manualAdjustmentDays: 0,
    zakatCalculationId: null,
    ...overrides,
  }
}

suite('reminder persistence', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('stores a reminder with its timezone and next occurrence', async () => {
    const actor = await createTestUser({ email: 'r1@test.local' })

    const reminder = await createReminder(actor, reminderInput(), NOW)

    expect(reminder.timezone).toBe(BRUSSELS)
    expect(reminder.status).toBe('ACTIVE')
    expect(reminder.nextTriggerAt?.toISOString()).toBe('2026-06-20T07:00:00.000Z')
    // Display only — the scheduler runs off the absolute instant (§6).
    expect(reminder.hijriLabel).toBeTruthy()
  })

  it('applies a manual day correction to the stored instant', async () => {
    const actor = await createTestUser({ email: 'r2@test.local' })

    const reminder = await createReminder(
      actor,
      reminderInput({ manualAdjustmentDays: 1 }),
      NOW,
    )

    expect(reminder.nextTriggerAt?.toISOString().slice(0, 10)).toBe('2026-06-21')
  })

  it('recomputes the next occurrence on update', async () => {
    const actor = await createTestUser({ email: 'r3@test.local' })
    const reminder = await createReminder(actor, reminderInput(), NOW)

    const updated = await updateReminder(
      actor,
      reminder.id,
      reminderInput({ startAt: new Date('2026-07-01T07:00:00.000Z') }),
      NOW,
    )

    expect(updated.nextTriggerAt?.toISOString().slice(0, 10)).toBe('2026-07-01')
  })

  it('links to a finalised calculation and keeps that identity', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'r4@test.local' })

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '55000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    const reminder = await createReminder(
      actor,
      reminderInput({ type: 'ZAKAT_DUE', zakatCalculationId: finalized.id }),
      NOW,
    )

    expect(reminder.zakatCalculationId).toBe(finalized.id)

    // A later calculation must not silently capture the old reminder (§10).
    await createAsset(actor, { type: 'CASH', name: 'Cash', value: '100.00', currency: 'EUR' })
    const second = await getOrCreateDraft(actor)

    const reread = await getReminder(actor, reminder.id)
    expect(reread.zakatCalculationId).toBe(finalized.id)
    expect(reread.zakatCalculationId).not.toBe(second.id)
  })

  it('refuses a calculation belonging to someone else', async () => {
    await createRuleSet()
    const owner = await createTestUser({ email: 'r5@test.local' })
    const stranger = await createTestUser({ email: 'r6@test.local' })

    await createAsset(owner, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '55000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(owner)

    await expect(
      createReminder(
        stranger,
        reminderInput({ zakatCalculationId: draft.id }),
        NOW,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('pauses, resumes and cancels', async () => {
    const actor = await createTestUser({ email: 'r7@test.local' })
    const reminder = await createReminder(actor, reminderInput({ recurrence: 'DAILY' }), NOW)

    const paused = await setReminderStatus(actor, reminder.id, 'PAUSED', NOW)
    expect(paused.status).toBe('PAUSED')
    // A paused reminder must not be picked up by the processor.
    expect(paused.nextTriggerAt).toBeNull()

    const resumed = await setReminderStatus(actor, reminder.id, 'ACTIVE', NOW)
    expect(resumed.status).toBe('ACTIVE')
    expect(resumed.nextTriggerAt).toBeTruthy()

    const cancelled = await cancelReminder(actor, reminder.id)
    expect(cancelled.status).toBe('CANCELLED')

    // Cancelled, not deleted — the notifications it produced still point at it.
    expect(await prisma.reminder.count({ where: { id: reminder.id } })).toBe(1)
  })
})

suite('due-reminder processing', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function dueReminder(email: string, overrides: Partial<ReminderCreatePayload> = {}) {
    const actor = await createTestUser({ email })
    const reminder = await createReminder(
      actor,
      reminderInput({ startAt: new Date('2026-06-10T07:00:00.000Z'), ...overrides }),
      new Date('2026-06-09T00:00:00.000Z'),
    )
    return { actor, reminder }
  }

  it('creates exactly one notification for a due reminder', async () => {
    const { actor } = await dueReminder('p1@test.local')

    const result = await processDueReminders(NOW)

    expect(result.examined).toBe(1)
    expect(result.delivered).toBe(1)

    const feed = await listNotifications(actor)
    expect(feed.notifications).toHaveLength(1)
    expect(feed.unreadCount).toBe(1)
    expect(feed.notifications[0]?.event).toBe('GENERAL')
  })

  it('creates nothing for a reminder that is not due yet', async () => {
    const { actor } = await dueReminder('p2@test.local', {
      startAt: new Date('2026-09-01T07:00:00.000Z'),
    })

    const result = await processDueReminders(NOW)

    expect(result.examined).toBe(0)
    expect((await listNotifications(actor)).notifications).toHaveLength(0)
  })

  it('produces one notification when the same run happens twice', async () => {
    const { actor } = await dueReminder('p3@test.local', { recurrence: 'DAILY' })

    await processDueReminders(NOW)
    // A retry that re-reads the same occurrence must not double-deliver.
    await prisma.reminder.updateMany({
      where: { userId: actor.userId },
      data: { nextTriggerAt: new Date('2026-06-10T07:00:00.000Z') },
    })
    const second = await processDueReminders(NOW)

    expect(second.deduplicated).toBe(1)
    expect((await listNotifications(actor)).notifications).toHaveLength(1)
  })

  it('produces one notification for two concurrent processors', async () => {
    const { actor } = await dueReminder('p4@test.local')

    // The unique index on (userId, dedupeKey) is what makes this safe — not
    // application ordering (§22, §23).
    const [a, b] = await Promise.all([processDueReminders(NOW), processDueReminders(NOW)])

    const delivered = a.delivered + b.delivered
    expect(delivered).toBeLessThanOrEqual(1)
    expect((await listNotifications(actor)).notifications).toHaveLength(1)
  })

  it('advances a recurring reminder to the next occurrence', async () => {
    const { actor } = await dueReminder('p5@test.local', { recurrence: 'DAILY' })

    await processDueReminders(NOW)

    const reminders = await listReminders(actor)
    expect(reminders[0]?.lastTriggeredAt?.toISOString()).toBe('2026-06-10T07:00:00.000Z')
    expect(reminders[0]?.nextTriggerAt?.getTime()).toBeGreaterThan(NOW.getTime())
    expect(reminders[0]?.status).toBe('ACTIVE')
  })

  it('completes a one-time reminder after firing', async () => {
    const { actor } = await dueReminder('p6@test.local', { recurrence: 'ONE_TIME' })

    await processDueReminders(NOW)

    const reminders = await listReminders(actor, { includeInactive: true })
    // Completed, not cancelled: the user never asked to cancel it (§13).
    expect(reminders[0]?.status).toBe('COMPLETED')
    expect(reminders[0]?.nextTriggerAt).toBeNull()
  })

  it('suppresses delivery when the category is switched off', async () => {
    const { actor } = await dueReminder('p7@test.local', { type: 'ZAKAT_DUE' })

    await prisma.notificationPreference.update({
      where: { userId: actor.userId },
      data: { zakatReminders: false },
    })

    const result = await processDueReminders(NOW)

    expect(result.suppressed).toBe(1)
    expect((await listNotifications(actor)).notifications).toHaveLength(0)

    // Still advanced: switching notifications off must not build a backlog.
    const reminders = await listReminders(actor, { includeInactive: true })
    expect(reminders[0]?.lastTriggeredAt).toBeTruthy()
  })

  it('sends one e-mail copy per occurrence, and keeps it out of the inbox', async () => {
    const { actor } = await dueReminder('mail1@test.local', { title: 'Zakat-dag nadert' })
    const sent: Array<{ to: string; subject: string }> = []
    const email = {
      name: 'none' as const,
      async send(message: { to: string; subject: string; text: string }) {
        sent.push({ to: message.to, subject: message.subject })
        return { delivered: true, providerId: 'x' }
      },
    }

    await Promise.all([processDueReminders(NOW, { email }), processDueReminders(NOW, { email })])

    expect(sent).toEqual([{ to: 'mail1@test.local', subject: 'Zakat-dag nadert' }])
    expect((await listNotifications(actor)).notifications).toHaveLength(1)
    const log = await prisma.notification.findMany({ where: { userId: actor.userId, channel: 'EMAIL' } })
    expect(log).toHaveLength(1)
    expect(log[0]?.status).toBe('SENT')
  })

  it('still sends the e-mail when a previous run stopped after the in-app notification', async () => {
    const { actor } = await dueReminder('mail4@test.local', { recurrence: 'DAILY' })
    // Ronde 1 zonder e-mail (alsof hij crashte vóór de mail), daarna dezelfde occurrence opnieuw.
    await processDueReminders(NOW, { email: null })
    await prisma.reminder.updateMany({
      where: { userId: actor.userId },
      data: { nextTriggerAt: new Date('2026-06-10T07:00:00.000Z') },
    })
    const sent: string[] = []
    const email = {
      name: 'none' as const,
      async send(message: { to: string }) {
        sent.push(message.to)
        return { delivered: true }
      },
    }
    const second = await processDueReminders(NOW, { email })

    expect(second.deduplicated).toBe(1)
    expect(sent).toEqual(['mail4@test.local'])
    expect((await listNotifications(actor)).notifications).toHaveLength(1)
  })

  it('sends no e-mail when the user turned e-mail off, and records failures', async () => {
    const off = await dueReminder('mail2@test.local')
    await prisma.notificationPreference.update({
      where: { userId: off.actor.userId },
      data: { emailEnabled: false },
    })
    const failing = await dueReminder('mail3@test.local')

    const sent: string[] = []
    const email = {
      name: 'none' as const,
      async send(message: { to: string }) {
        sent.push(message.to)
        return { delivered: false, error: 'kapot' }
      },
    }
    const result = await processDueReminders(NOW, { email })

    expect(result.delivered).toBe(2)
    expect(sent).toEqual(['mail3@test.local'])
    const row = await prisma.notification.findFirst({
      where: { userId: failing.actor.userId, channel: 'EMAIL' },
    })
    expect(row?.status).toBe('FAILED')
  })

  it('ignores paused and cancelled reminders', async () => {
    const { actor, reminder } = await dueReminder('p8@test.local')
    await setReminderStatus(actor, reminder.id, 'PAUSED', NOW)

    expect((await processDueReminders(NOW)).examined).toBe(0)

    await cancelReminder(actor, reminder.id)
    expect((await processDueReminders(NOW)).examined).toBe(0)
  })

  it('deep-links a Zakat reminder to its calculation', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'p9@test.local' })

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '55000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    await createReminder(
      actor,
      reminderInput({
        type: 'ZAKAT_DUE',
        startAt: new Date('2026-06-10T07:00:00.000Z'),
        zakatCalculationId: finalized.id,
      }),
      new Date('2026-06-09T00:00:00.000Z'),
    )

    await processDueReminders(NOW)

    const feed = await listNotifications(actor)
    expect(feed.notifications[0]?.href).toBe(`/zakat/calculations/${finalized.id}`)
    expect(feed.notifications[0]?.event).toBe('ZAKAT_REMINDER_DUE')
  })

  it('does not mark the Zakat as paid', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'p10@test.local' })

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '55000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    await createReminder(
      actor,
      reminderInput({
        type: 'ZAKAT_DUE',
        startAt: new Date('2026-06-10T07:00:00.000Z'),
        zakatCalculationId: finalized.id,
      }),
      new Date('2026-06-09T00:00:00.000Z'),
    )

    await processDueReminders(NOW)

    // A delivered notification is not a payment (§12).
    const { getZakatPaymentSummary } = await import(
      '@/server/modules/donations/payment-service'
    )
    const summary = await getZakatPaymentSummary(actor, finalized.id)

    expect(summary.paidMinor).toBe(0)
    expect(summary.status).toBe('UNPAID')
  })
})

suite('notification centre', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function withNotification(email: string) {
    const actor = await createTestUser({ email })
    await createReminder(
      actor,
      reminderInput({ startAt: new Date('2026-06-10T07:00:00.000Z') }),
      new Date('2026-06-09T00:00:00.000Z'),
    )
    await processDueReminders(NOW)

    const feed = await listNotifications(actor)
    return { actor, notification: feed.notifications[0]! }
  }

  it('marks one as read', async () => {
    const { actor, notification } = await withNotification('n1@test.local')

    const updated = await markRead(actor, notification.id)

    expect(updated.readAt).toBeTruthy()
    expect(updated.status).toBe('READ')
    expect((await listNotifications(actor)).unreadCount).toBe(0)
  })

  it('marks all as read', async () => {
    const { actor } = await withNotification('n2@test.local')

    expect(await markAllRead(actor)).toBe(1)
    expect((await listNotifications(actor)).unreadCount).toBe(0)
  })

  it('is idempotent when marking an already-read notification', async () => {
    const { actor, notification } = await withNotification('n3@test.local')

    await markRead(actor, notification.id)
    await expect(markRead(actor, notification.id)).resolves.toBeTruthy()
  })
})

suite('reminder and notification isolation', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('never shows another user’s reminders', async () => {
    const a = await createTestUser({ email: 'i1@test.local' })
    const b = await createTestUser({ email: 'i2@test.local' })

    const reminder = await createReminder(b, reminderInput(), NOW)

    expect(await listReminders(a)).toHaveLength(0)
    await expect(getReminder(a, reminder.id)).rejects.toThrow(ReminderNotFoundError)
  })

  it('refuses cross-user updates, status changes and cancellation', async () => {
    const a = await createTestUser({ email: 'i3@test.local' })
    const b = await createTestUser({ email: 'i4@test.local' })

    const reminder = await createReminder(b, reminderInput(), NOW)

    await expect(updateReminder(a, reminder.id, reminderInput(), NOW)).rejects.toThrow(
      ReminderNotFoundError,
    )
    await expect(setReminderStatus(a, reminder.id, 'PAUSED', NOW)).rejects.toThrow(
      ReminderNotFoundError,
    )
    await expect(cancelReminder(a, reminder.id)).rejects.toThrow(ReminderNotFoundError)

    const unchanged = await getReminder(b, reminder.id)
    expect(unchanged.status).toBe('ACTIVE')
  })

  it('never shows another user’s notifications', async () => {
    const a = await createTestUser({ email: 'i5@test.local' })
    await createReminder(
      a,
      reminderInput({ startAt: new Date('2026-06-10T07:00:00.000Z') }),
      new Date('2026-06-09T00:00:00.000Z'),
    )
    await processDueReminders(NOW)

    const b = await createTestUser({ email: 'i6@test.local' })
    expect((await listNotifications(b)).notifications).toHaveLength(0)
  })

  it('refuses to mark another user’s notification read', async () => {
    const a = await createTestUser({ email: 'i7@test.local' })
    await createReminder(
      a,
      reminderInput({ startAt: new Date('2026-06-10T07:00:00.000Z') }),
      new Date('2026-06-09T00:00:00.000Z'),
    )
    await processDueReminders(NOW)

    const notification = (await listNotifications(a)).notifications[0]!
    const b = await createTestUser({ email: 'i8@test.local' })

    await expect(markRead(b, notification.id)).rejects.toThrow(NotificationNotFoundError)

    // And A's notification is genuinely untouched.
    const reread = await listNotifications(a)
    expect(reread.unreadCount).toBe(1)
  })

  it('gives a household member no access to personal reminders', async () => {
    const owner = await createTestUser({ email: 'i9@test.local' })
    const member = await createTestUser({ email: 'i10@test.local' })

    const household = await prisma.household.create({
      data: {
        name: 'Familie',
        ownerUserId: owner.userId,
        members: {
          create: [
            { userId: owner.userId, role: 'OWNER', sharesFinancials: true },
            { userId: member.userId, role: 'MEMBER', sharesFinancials: true },
          ],
        },
      },
    })

    const memberScoped: Actor = {
      ...member,
      households: [{ householdId: household.id, role: 'MEMBER', sharesFinancials: true }],
    }

    await createReminder(owner, reminderInput(), NOW)

    // Sharing finances does not share private prompts to oneself (§19).
    expect(await listReminders(memberScoped)).toHaveLength(0)
  })
})
