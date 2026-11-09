import 'server-only'

import type { NotificationChannel } from '@prisma/client'
import { Prisma } from '@prisma/client'

import { minutesOfDayIn, safeTimezone } from '@/lib/dates'
import { logger } from '@/lib/logger'
import { getTranslator, type TranslationKey } from '@/i18n'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { getNotificationProvider } from '@/server/integrations/notifications'
import { NotificationProviderError } from '@/server/integrations/notifications/types'
import {
  NOTIFICATION_DEFINITIONS,
  NOTIFICATION_VARIABLES,
  type NotificationType,
  type NotificationVariables,
} from '@/server/modules/notifications/catalogue'
import {
  parseNotificationPreferences,
  resolveChannels,
  type NotificationPreferences,
} from '@/server/modules/notifications/preferences'

/**
 * Notification dispatch.
 *
 * The order below is the whole point of this module and must not be rearranged:
 *
 *   recipient state → preferences → channels → persist → provider
 *
 * A member who muted a type, or who is inside quiet hours, or whose account is
 * being deleted, never becomes an outbound request. The provider is the last
 * thing touched, not the first.
 */

export interface DispatchInput {
  userId: string
  type: NotificationType
  /**
   * What this notification is *about* — a habit id, a prayer name, a period.
   * Combined with type and occurrence to form the idempotency key, so a retried
   * job cannot notify twice about the same thing.
   */
  resourceId?: string
  /**
   * Distinguishes repeats of the same resource: a date for a daily reminder, an
   * ISO week for a weekly one. Defaults to `once`.
   */
  occurrence?: string
  variables?: NotificationVariables
  /** Deep link, relative to the app root. */
  url?: string
}

export interface DispatchResult {
  /** Null when nothing was created — muted, suppressed, or already dispatched. */
  notificationId: string | null
  channels: readonly NotificationChannel[]
  reason?: 'MUTED' | 'RECIPIENT_UNAVAILABLE' | 'ALREADY_DISPATCHED' | 'NO_CHANNELS'
}

export function buildIdempotencyKey(input: DispatchInput): string {
  return [input.type, input.userId, input.resourceId ?? 'none', input.occurrence ?? 'once'].join(':')
}

/**
 * Only catalogue-declared variables may be interpolated.
 *
 * Without this, `variables` is an open door: a caller could pass a habit name
 * into a template and it would end up rendered into an email body. Unknown keys
 * are dropped rather than rejected, because a stale caller should not fail a
 * billing notification.
 */
function filterVariables(
  type: NotificationType,
  variables: NotificationVariables | undefined,
): NotificationVariables {
  if (!variables) return {}

  const allowed = NOTIFICATION_VARIABLES[type]
  const out: NotificationVariables = {}

  for (const [key, value] of Object.entries(variables)) {
    if (!allowed.includes(key)) {
      logger.warn('notifications.variable.rejected', { type, key })
      continue
    }
    out[key] = value
  }

  return out
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const definition = NOTIFICATION_DEFINITIONS[input.type]

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      locale: true,
      timezone: true,
      deletedAt: true,
      deletionStatus: true,
      preference: { select: { notificationPrefs: true } },
    },
  })

  // A departed or departing member is not someone to message. The deletion
  // notifications themselves are sent by the deletion service, before the
  // status moves, precisely so they are not caught by this check.
  if (!user || user.deletedAt || user.deletionStatus === 'COMPLETED') {
    return { notificationId: null, channels: [], reason: 'RECIPIENT_UNAVAILABLE' }
  }

  const preferences = parseNotificationPreferences(user.preference?.notificationPrefs)
  const provider = getNotificationProvider()

  const channels = resolveChannels(input.type, preferences, {
    localMinute: minutesOfDayIn(safeTimezone(user.timezone)),
    availableChannels: provider.channels,
  })

  if (channels.length === 0) {
    return {
      notificationId: null,
      channels: [],
      reason: preferences.allMuted && !definition.transactional ? 'MUTED' : 'NO_CHANNELS',
    }
  }

  // Rendered in the member's language, not the server's.
  const t = getTranslator(user.locale)
  const variables = filterVariables(input.type, input.variables)
  const title = t(`${definition.messageKey}.title` as TranslationKey, variables)
  const body = t(`${definition.messageKey}.body` as TranslationKey, variables)

  const idempotencyKey = buildIdempotencyKey(input)

  let notificationId: string
  try {
    const created = await prisma.notification.create({
      data: {
        userId: user.id,
        type: input.type,
        title,
        body,
        idempotencyKey,
        // Structured payload for the client. Deliberately no free text beyond
        // the already-rendered title and body.
        data: { url: input.url ?? null, variables },
        deliveries: {
          create: channels.map((channel) => ({
            userId: user.id,
            channel,
            provider: provider.id,
          })),
        },
      },
      select: { id: true },
    })
    notificationId = created.id
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // The unique key did its job: this exact notification already exists.
      return { notificationId: null, channels: [], reason: 'ALREADY_DISPATCHED' }
    }
    throw error
  }

  await Promise.all(
    channels.map((channel) =>
      deliver({
        notificationId,
        userId: user.id,
        channel,
        idempotencyKey,
        title,
        body,
        url: input.url,
        email: user.email,
      }),
    ),
  )

  return { notificationId, channels }
}

async function deliver(args: {
  notificationId: string
  userId: string
  channel: NotificationChannel
  idempotencyKey: string
  title: string
  body: string
  url?: string
  email: string
}): Promise<void> {
  const provider = getNotificationProvider()

  // In-app delivery is the notification row. There is nothing to send, and
  // asking a provider to "send" it would only invent a failure mode.
  if (args.channel === 'IN_APP') {
    await markDelivery(args.notificationId, args.channel, {
      status: 'SENT',
      sentAt: new Date(),
      provider: 'internal',
    })
    return
  }

  try {
    const result = await provider.send({
      userId: args.userId,
      channel: args.channel,
      idempotencyKey: `${args.idempotencyKey}:${args.channel}`,
      title: args.title,
      body: args.body,
      url: args.url,
      // Contact details are resolved per channel, so an in-app notification
      // never carries an address it has no use for.
      destination: args.channel === 'EMAIL' ? { email: args.email } : undefined,
    })

    await markDelivery(args.notificationId, args.channel, {
      status: result.accepted ? 'SENT' : 'FAILED',
      sentAt: result.accepted ? new Date() : null,
      provider: provider.id,
    })
  } catch (error) {
    const code = error instanceof NotificationProviderError ? error.code : 'UNKNOWN'

    // A delivery failure must not fail the caller: a habit tick that also fires
    // a reminder should not roll back because an email bounced.
    logger.warn('notifications.delivery.failed', {
      channel: args.channel,
      code,
      // No title, body or address — this line goes to a log drain.
    })

    await markDelivery(args.notificationId, args.channel, {
      status: code === 'UNSUPPORTED_CHANNEL' ? 'SUPPRESSED' : 'FAILED',
      sentAt: null,
      provider: provider.id,
      lastError: code,
    })
  }
}

async function markDelivery(
  notificationId: string,
  channel: NotificationChannel,
  update: {
    status: 'SENT' | 'FAILED' | 'SUPPRESSED'
    sentAt: Date | null
    provider: string
    lastError?: string
  },
): Promise<void> {
  try {
    await prisma.notificationDelivery.update({
      where: { notificationId_channel: { notificationId, channel } },
      data: {
        status: update.status,
        sentAt: update.sentAt,
        provider: update.provider,
        lastError: update.lastError ?? null,
        attempts: { increment: 1 },
      },
    })
  } catch (error) {
    logger.warn('notifications.delivery.record_failed', { channel, error: String(error) })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationView {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  readAt: Date | null
  createdAt: Date
}

export async function listNotifications(
  actor: Actor,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: {
      userId: actor.userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
      // Only surface what actually has an in-app delivery; an email-only
      // notification should not appear in the bell menu.
      deliveries: { some: { channel: 'IN_APP' } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(options.limit ?? 25, 100),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url:
      typeof row.data === 'object' && row.data !== null && 'url' in row.data
        ? ((row.data as { url?: string | null }).url ?? null)
        : null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }))
}

export async function countUnread(actor: Actor): Promise<number> {
  return prisma.notification.count({
    where: { userId: actor.userId, readAt: null, deliveries: { some: { channel: 'IN_APP' } } },
  })
}

export async function markRead(actor: Actor, notificationId: string): Promise<void> {
  // Scoped by userId, so an id from another member updates nothing rather than
  // leaking its existence through a different error.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  })
}

export async function markAllRead(actor: Actor): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  })
  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences
// ─────────────────────────────────────────────────────────────────────────────

export async function getNotificationPreferences(actor: Actor): Promise<NotificationPreferences> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    select: { notificationPrefs: true },
  })

  return parseNotificationPreferences(preference?.notificationPrefs)
}
