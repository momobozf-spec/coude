import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  NOTIFICATION_DEFINITIONS,
  NOTIFICATION_TYPES,
  NOTIFICATION_VARIABLES,
  type NotificationType,
} from '@/server/modules/notifications/catalogue'
import {
  isInQuietHours,
  mergeNotificationPreferences,
  parseNotificationPreferences,
  resolveChannels,
  serialiseNotificationPreferences,
} from '@/server/modules/notifications/preferences'
import {
  createStubNotificationProvider,
  resetStubNotifications,
  stubSentNotifications,
} from '@/server/integrations/notifications/stub-provider'
import { NotificationProviderError } from '@/server/integrations/notifications/types'

const ALL_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL'] as const

function defaults() {
  return parseNotificationPreferences({})
}

describe('catalogue', () => {
  it('uses the key as the type, so a rename cannot diverge', () => {
    for (const [key, value] of Object.entries(NOTIFICATION_TYPES)) {
      expect(key).toBe(value)
    }
  })

  it('defines every declared type', () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      expect(NOTIFICATION_DEFINITIONS[type], type).toBeDefined()
      expect(NOTIFICATION_VARIABLES[type], type).toBeDefined()
    }
  })

  it('keeps default channels within allowed channels', () => {
    for (const definition of Object.values(NOTIFICATION_DEFINITIONS)) {
      for (const channel of definition.defaultChannels) {
        expect(definition.allowedChannels, definition.type).toContain(channel)
      }
    }
  })

  it('leaves every optional reminder off by default', () => {
    // A prayer reminder nobody asked for is precisely the guilt mechanic this
    // product refuses to ship.
    for (const type of ['PRAYER_REMINDER', 'HABIT_REMINDER', 'PLANNER_BLOCK_STARTING'] as const) {
      expect(NOTIFICATION_DEFINITIONS[type].defaultChannels, type).toEqual([])
    }
  })

  it('has no re-engagement or streak notification', () => {
    const types = Object.keys(NOTIFICATION_TYPES).join(' ').toUpperCase()

    for (const forbidden of ['STREAK', 'INACTIVE', 'MISSED', 'BEHIND', 'RANK', 'COMPARE']) {
      expect(types, forbidden).not.toContain(forbidden)
    }
  })

  it('marks money, security and requested things as transactional — and nothing else', () => {
    const transactional = Object.values(NOTIFICATION_DEFINITIONS)
      .filter((definition) => definition.transactional)
      .map((definition) => definition.type)
      .sort()

    expect(transactional).toEqual(
      [
        'ACCOUNT_DELETION_COMPLETED',
        'ACCOUNT_DELETION_REQUESTED',
        'BILLING_PAYMENT_FAILED',
        'BILLING_SUBSCRIPTION_ENDED',
        'DATA_EXPORT_READY',
      ].sort(),
    )
  })

  it('allows only closed-vocabulary variables', () => {
    // `prayer` is one of five fixed names; nothing here can carry a habit title
    // or a reflection into a message body.
    const allowed = new Set(['prayer', 'minutes', 'weekNumber', 'graceDays'])

    for (const [type, variables] of Object.entries(NOTIFICATION_VARIABLES)) {
      for (const variable of variables) {
        expect(allowed.has(variable), `${type}.${variable}`).toBe(true)
      }
    }
  })

  it('reaches a deleted member by email only', () => {
    // In-app is pointless once the account is gone.
    expect(NOTIFICATION_DEFINITIONS.ACCOUNT_DELETION_COMPLETED.allowedChannels).toEqual(['EMAIL'])
  })
})

describe('preference parsing', () => {
  it('falls back to catalogue defaults for an empty column', () => {
    const preferences = defaults()

    expect(preferences.allMuted).toBe(false)
    expect(preferences.quietHours).toBeNull()
    expect(preferences.types.WEEKLY_REVIEW_READY).toEqual(['IN_APP'])
  })

  it('survives malformed JSON without throwing', () => {
    // The column can predate any change to this code.
    for (const stored of [null, undefined, 42, 'nonsense', [], { types: 'wrong' }]) {
      expect(() => parseNotificationPreferences(stored)).not.toThrow()
    }

    expect(parseNotificationPreferences('nonsense').types.PRAYER_REMINDER).toEqual([])
  })

  it('drops a type that no longer exists in the catalogue', () => {
    const preferences = parseNotificationPreferences({
      types: { LEGACY_STREAK_WARNING: { channels: ['PUSH'] } },
    })

    expect(Object.keys(preferences.types)).not.toContain('LEGACY_STREAK_WARNING')
  })

  it('drops a channel the type does not allow', () => {
    const preferences = parseNotificationPreferences({
      types: { PRAYER_REMINDER: { channels: ['EMAIL', 'PUSH'] } },
    })

    // Prayer reminders are in-app and push only; email is not offered.
    expect(preferences.types.PRAYER_REMINDER).toEqual(['PUSH'])
  })

  it('round-trips through serialisation', () => {
    const original = mergeNotificationPreferences(defaults(), {
      allMuted: true,
      quietHours: { startMinute: 1320, endMinute: 420 },
      types: { PRAYER_REMINDER: { channels: ['PUSH'] } },
    })

    const restored = parseNotificationPreferences(serialiseNotificationPreferences(original))

    expect(restored.allMuted).toBe(true)
    expect(restored.quietHours).toEqual({ startMinute: 1320, endMinute: 420 })
    expect(restored.types.PRAYER_REMINDER).toEqual(['PUSH'])
  })

  it('leaves untouched fields alone when merging', () => {
    const merged = mergeNotificationPreferences(
      mergeNotificationPreferences(defaults(), { allMuted: true }),
      { types: { HABIT_REMINDER: { channels: ['IN_APP'] } } },
    )

    expect(merged.allMuted).toBe(true)
    expect(merged.types.HABIT_REMINDER).toEqual(['IN_APP'])
  })
})

describe('quiet hours', () => {
  it('is inactive when unset', () => {
    expect(isInQuietHours(null, 180)).toBe(false)
  })

  it('handles a window that wraps midnight', () => {
    // 22:00 → 07:00 is the common case and must not be treated as invalid.
    const window = { startMinute: 22 * 60, endMinute: 7 * 60 }

    expect(isInQuietHours(window, 23 * 60)).toBe(true)
    expect(isInQuietHours(window, 3 * 60)).toBe(true)
    expect(isInQuietHours(window, 12 * 60)).toBe(false)
    expect(isInQuietHours(window, 7 * 60)).toBe(false)
  })

  it('handles a window inside one day', () => {
    const window = { startMinute: 13 * 60, endMinute: 15 * 60 }

    expect(isInQuietHours(window, 14 * 60)).toBe(true)
    expect(isInQuietHours(window, 16 * 60)).toBe(false)
  })

  it('treats an empty window as no window', () => {
    expect(isInQuietHours({ startMinute: 600, endMinute: 600 }, 600)).toBe(false)
  })
})

describe('channel resolution', () => {
  it('sends nothing for a type the member never enabled', () => {
    expect(
      resolveChannels('PRAYER_REMINDER', defaults(), { availableChannels: ALL_CHANNELS }),
    ).toEqual([])
  })

  it('sends on the channels the member chose', () => {
    const preferences = mergeNotificationPreferences(defaults(), {
      types: { PRAYER_REMINDER: { channels: ['PUSH', 'IN_APP'] } },
    })

    expect(
      resolveChannels('PRAYER_REMINDER', preferences, { availableChannels: ALL_CHANNELS }),
    ).toEqual(['PUSH', 'IN_APP'])
  })

  it('silences optional notifications when everything is muted', () => {
    const preferences = mergeNotificationPreferences(defaults(), {
      allMuted: true,
      types: { PRAYER_REMINDER: { channels: ['PUSH'] } },
    })

    expect(
      resolveChannels('PRAYER_REMINDER', preferences, { availableChannels: ALL_CHANNELS }),
    ).toEqual([])
  })

  it('still delivers a failed payment when everything is muted', () => {
    // Silencing this would leave someone unaware their card failed, which is a
    // worse outcome for them than the interruption.
    const preferences = mergeNotificationPreferences(defaults(), { allMuted: true })

    expect(
      resolveChannels('BILLING_PAYMENT_FAILED', preferences, { availableChannels: ALL_CHANNELS })
        .length,
    ).toBeGreaterThan(0)
  })

  it('holds optional notifications during quiet hours', () => {
    const preferences = mergeNotificationPreferences(defaults(), {
      quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 },
      types: { HABIT_REMINDER: { channels: ['PUSH'] } },
    })

    expect(
      resolveChannels('HABIT_REMINDER', preferences, {
        localMinute: 23 * 60,
        availableChannels: ALL_CHANNELS,
      }),
    ).toEqual([])

    expect(
      resolveChannels('HABIT_REMINDER', preferences, {
        localMinute: 10 * 60,
        availableChannels: ALL_CHANNELS,
      }),
    ).toEqual(['PUSH'])
  })

  it('ignores quiet hours for transactional messages', () => {
    const preferences = mergeNotificationPreferences(defaults(), {
      quietHours: { startMinute: 0, endMinute: 1439 },
    })

    expect(
      resolveChannels('BILLING_PAYMENT_FAILED', preferences, {
        localMinute: 300,
        availableChannels: ALL_CHANNELS,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('drops channels the provider cannot deliver on', () => {
    const preferences = mergeNotificationPreferences(defaults(), {
      types: { PRAYER_REMINDER: { channels: ['PUSH', 'IN_APP'] } },
    })

    expect(
      resolveChannels('PRAYER_REMINDER', preferences, { availableChannels: ['IN_APP'] }),
    ).toEqual(['IN_APP'])
  })

  it('never returns a channel outside the type’s allow-list', () => {
    const everything = mergeNotificationPreferences(defaults(), {
      types: Object.fromEntries(
        Object.keys(NOTIFICATION_TYPES).map((type) => [type, { channels: [...ALL_CHANNELS] }]),
      ) as never,
    })

    for (const type of Object.values(NOTIFICATION_TYPES) as NotificationType[]) {
      const channels = resolveChannels(type, everything, { availableChannels: ALL_CHANNELS })

      for (const channel of channels) {
        expect(NOTIFICATION_DEFINITIONS[type].allowedChannels, `${type}/${channel}`).toContain(
          channel,
        )
      }
    }
  })
})

describe('stub provider', () => {
  const provider = createStubNotificationProvider()

  beforeEach(() => resetStubNotifications())
  afterEach(() => resetStubNotifications())

  it('accepts an in-app delivery with no contact details', async () => {
    const result = await provider.send({
      userId: 'user-1',
      channel: 'IN_APP',
      idempotencyKey: 'k1',
      title: 'Title',
      body: 'Body',
    })

    expect(result.accepted).toBe(true)
    expect(stubSentNotifications('IN_APP')).toHaveLength(1)
  })

  it('still validates a destination, so the wiring is exercised', async () => {
    // The stub sends nothing, but it must fail in the same places a real
    // provider would — otherwise it proves nothing.
    await expect(
      provider.send({
        userId: 'user-1',
        channel: 'EMAIL',
        idempotencyKey: 'k2',
        title: 'Title',
        body: 'Body',
      }),
    ).rejects.toBeInstanceOf(NotificationProviderError)

    await expect(
      provider.send({
        userId: 'user-1',
        channel: 'PUSH',
        idempotencyKey: 'k3',
        title: 'Title',
        body: 'Body',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DESTINATION' })
  })

  it('declares itself a stub, so the UI can say so', () => {
    expect(provider.isStub).toBe(true)
  })
})

describe('dispatch order', () => {
  const service = readFileSync(
    resolve(process.cwd(), 'src/server/modules/notifications/notification.service.ts'),
    'utf8',
  )

  it('checks the recipient and preferences before touching a provider', () => {
    const recipient = service.indexOf('prisma.user.findUnique')
    const preferences = service.indexOf('parseNotificationPreferences(')
    const channels = service.indexOf('resolveChannels(')
    const send = service.indexOf('provider.send(')

    expect(recipient).toBeLessThan(preferences)
    expect(preferences).toBeLessThan(channels)
    expect(channels).toBeLessThan(send)
  })

  it('returns early when no channel survives', () => {
    expect(service).toContain('if (channels.length === 0)')
  })

  it('refuses to message a departed member', () => {
    expect(service).toContain("user.deletionStatus === 'COMPLETED'")
    expect(service).toContain('user.deletedAt')
  })

  it('deduplicates through a unique key rather than a lookup', () => {
    // A read-then-write would race two concurrent jobs into two notifications.
    expect(service).toContain("error.code === 'P2002'")
    expect(service).toContain("reason: 'ALREADY_DISPATCHED'")
  })

  it('filters interpolation variables against the catalogue', () => {
    expect(service).toContain('filterVariables(')
    expect(service).toContain('NOTIFICATION_VARIABLES[type]')
  })

  it('renders in the member’s language, not the server’s', () => {
    expect(service).toContain('getTranslator(user.locale)')
  })

  it('does not log message content', () => {
    const failureBlock = service.slice(service.indexOf("logger.warn('notifications.delivery.failed'"))
    // Comments are stripped first: the code says what it does not log, and that
    // sentence would otherwise trip the assertion it explains.
    const call = failureBlock.slice(0, failureBlock.indexOf('})')).replace(/\/\/.*$/gm, '')

    expect(call).not.toContain('title')
    expect(call).not.toContain('body')
    expect(call).not.toContain('email')
  })

  it('scopes every read to the caller', () => {
    for (const fragment of ['userId: actor.userId, readAt: null', 'where: { userId: actor.userId']) {
      expect(service).toContain(fragment)
    }
  })
})
