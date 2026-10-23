import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { resetStubNotifications } from '@/server/integrations/notifications/stub-provider'
import { setNotificationProvider } from '@/server/integrations/notifications'
import {
  actorFor,
  cleanup,
  createTestUser,
  disconnect,
  hasTestDatabase,
  testPrisma,
} from './setup'

/**
 * Notification dispatch against a real database.
 *
 * The unique idempotency key is the interesting part: only a database can prove
 * that two concurrent dispatches produce one notification rather than two.
 */

const describeIf = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '[integration] TEST_DATABASE_URL is not set — notification tests are SKIPPED, not passing.',
  )
}

describeIf('notifications (integration)', () => {
  const created: string[] = []

  afterEach(() => {
    resetStubNotifications()
    setNotificationProvider(null)
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function member(email: string) {
    const user = await createTestUser(email)
    created.push(user.id)
    return user
  }

  async function enable(userId: string, type: string, channels: string[]) {
    await testPrisma().userPreference.update({
      where: { userId },
      data: { notificationPrefs: { types: { [type]: { channels } } } },
    })
  }

  it('creates a notification with an in-app delivery', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-basic-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])

    const result = await dispatchNotification({
      userId: user.id,
      type: 'HABIT_REMINDER',
      resourceId: 'habit-1',
      occurrence: '2026-08-09',
      variables: { minutes: 10 },
    })

    expect(result.notificationId).not.toBeNull()
    expect(result.channels).toEqual(['IN_APP'])

    const delivery = await prisma.notificationDelivery.findFirstOrThrow({
      where: { notificationId: result.notificationId! },
    })

    expect(delivery.channel).toBe('IN_APP')
    expect(delivery.status).toBe('SENT')
    expect(delivery.sentAt).not.toBeNull()
  })

  it('interpolates only catalogue-declared variables', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-vars-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])

    const result = await dispatchNotification({
      userId: user.id,
      type: 'HABIT_REMINDER',
      occurrence: 'vars',
      // `habitName` is not in the catalogue and must not reach the message.
      variables: { minutes: 15, habitName: 'Tahajjud' } as never,
    })

    const notification = await prisma.notification.findUniqueOrThrow({
      where: { id: result.notificationId! },
    })

    expect(notification.title).toContain('15')
    expect(`${notification.title} ${notification.body} ${JSON.stringify(notification.data)}`).not.toContain(
      'Tahajjud',
    )
  })

  it('sends nothing for a type the member never enabled', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-off-${Date.now()}@test.local`)

    const result = await dispatchNotification({
      userId: user.id,
      type: 'PRAYER_REMINDER',
      occurrence: 'off',
      variables: { prayer: 'Fajr', minutes: 10 },
    })

    expect(result.notificationId).toBeNull()
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0)
  })

  it('delivers a transactional notification even when everything is muted', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-muted-${Date.now()}@test.local`)
    await prisma.userPreference.update({
      where: { userId: user.id },
      data: { notificationPrefs: { allMuted: true } },
    })

    const result = await dispatchNotification({
      userId: user.id,
      type: 'BILLING_PAYMENT_FAILED',
      occurrence: 'muted',
      variables: { graceDays: 7 },
    })

    expect(result.notificationId).not.toBeNull()
    expect(result.channels.length).toBeGreaterThan(0)
  })

  it('creates one notification when the same dispatch runs twice', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-idem-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])

    const input = {
      userId: user.id,
      type: 'HABIT_REMINDER' as const,
      resourceId: 'habit-9',
      occurrence: '2026-08-09',
      variables: { minutes: 5 },
    }

    const first = await dispatchNotification(input)
    const second = await dispatchNotification(input)

    expect(first.notificationId).not.toBeNull()
    expect(second.notificationId).toBeNull()
    expect(second.reason).toBe('ALREADY_DISPATCHED')
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1)
  })

  it('creates one notification under concurrent dispatch', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-race-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])

    const input = {
      userId: user.id,
      type: 'HABIT_REMINDER' as const,
      resourceId: 'habit-race',
      occurrence: '2026-08-09',
      variables: { minutes: 5 },
    }

    // A read-then-write would let both of these through.
    const results = await Promise.all([
      dispatchNotification(input),
      dispatchNotification(input),
      dispatchNotification(input),
    ])

    expect(results.filter((result) => result.notificationId !== null)).toHaveLength(1)
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1)
  })

  it('refuses to message a deleted member', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-deleted-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])
    await prisma.user.update({
      where: { id: user.id },
      data: { deletionStatus: 'COMPLETED', deletedAt: new Date() },
    })

    const result = await dispatchNotification({
      userId: user.id,
      type: 'HABIT_REMINDER',
      occurrence: 'after-deletion',
      variables: { minutes: 5 },
    })

    expect(result.reason).toBe('RECIPIENT_UNAVAILABLE')
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0)
  })

  it('records a failed delivery instead of throwing', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-fail-${Date.now()}@test.local`)
    await enable(user.id, 'WEEKLY_REVIEW_READY', ['EMAIL'])

    setNotificationProvider({
      id: 'always-fails',
      channels: ['IN_APP', 'PUSH', 'EMAIL'],
      isStub: true,
      async send() {
        throw new Error('provider is down')
      },
    })

    // A reminder that cannot be delivered must not fail the caller.
    const result = await dispatchNotification({
      userId: user.id,
      type: 'WEEKLY_REVIEW_READY',
      occurrence: '2026-W32',
      variables: { weekNumber: 32 },
    })

    expect(result.notificationId).not.toBeNull()

    const delivery = await prisma.notificationDelivery.findFirstOrThrow({
      where: { notificationId: result.notificationId!, channel: 'EMAIL' },
    })

    expect(delivery.status).toBe('FAILED')
    expect(delivery.sentAt).toBeNull()
    expect(delivery.attempts).toBe(1)
  })

  it('renders in the member’s language', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-locale-${Date.now()}@test.local`)
    await prisma.user.update({ where: { id: user.id }, data: { locale: 'nl' } })
    await enable(user.id, 'WEEKLY_REVIEW_READY', ['IN_APP'])

    const result = await dispatchNotification({
      userId: user.id,
      type: 'WEEKLY_REVIEW_READY',
      occurrence: '2026-W33',
      variables: { weekNumber: 33 },
    })

    const notification = await prisma.notification.findUniqueOrThrow({
      where: { id: result.notificationId! },
    })

    expect(notification.title).toBe('Je week staat klaar om op terug te kijken')
  })

  it('shows in-app notifications to their owner and nobody else', async () => {
    const { countUnread, dispatchNotification, listNotifications, markAllRead, markRead } =
      await import('@/server/modules/notifications/notification.service')

    const mine = await member(`notify-mine-${Date.now()}@test.local`)
    const theirs = await member(`notify-theirs-${Date.now()}@test.local`)

    await enable(mine.id, 'HABIT_REMINDER', ['IN_APP'])
    await enable(theirs.id, 'HABIT_REMINDER', ['IN_APP'])

    const own = await dispatchNotification({
      userId: mine.id,
      type: 'HABIT_REMINDER',
      occurrence: 'scoped',
      variables: { minutes: 5 },
    })
    await dispatchNotification({
      userId: theirs.id,
      type: 'HABIT_REMINDER',
      occurrence: 'scoped',
      variables: { minutes: 5 },
    })

    const myActor = actorFor(mine.id, mine.email)
    const theirActor = actorFor(theirs.id, theirs.email)

    expect(await listNotifications(myActor)).toHaveLength(1)
    expect(await countUnread(myActor)).toBe(1)

    // Another member's id must silently match nothing, not read as theirs.
    await markRead(theirActor, own.notificationId!)
    expect(await countUnread(myActor)).toBe(1)

    await markRead(myActor, own.notificationId!)
    expect(await countUnread(myActor)).toBe(0)
    expect(await countUnread(theirActor)).toBe(1)

    await markAllRead(theirActor)
    expect(await countUnread(theirActor)).toBe(0)
  })

  it('deletes deliveries with the notification', async () => {
    const prisma = testPrisma()
    const { dispatchNotification } = await import(
      '@/server/modules/notifications/notification.service'
    )

    const user = await member(`notify-cascade-${Date.now()}@test.local`)
    await enable(user.id, 'HABIT_REMINDER', ['IN_APP'])

    const result = await dispatchNotification({
      userId: user.id,
      type: 'HABIT_REMINDER',
      occurrence: 'cascade',
      variables: { minutes: 5 },
    })

    await prisma.notification.delete({ where: { id: result.notificationId! } })

    expect(
      await prisma.notificationDelivery.count({
        where: { notificationId: result.notificationId! },
      }),
    ).toBe(0)
  })
})
