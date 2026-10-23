import 'server-only'

import type { NotificationChannel } from '@prisma/client'

import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { createStubNotificationProvider } from '@/server/integrations/notifications/stub-provider'
import type {
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from '@/server/integrations/notifications/types'

/**
 * Provider resolution.
 *
 * There is no live email or push provider yet, and this module does not pretend
 * otherwise. Both configurable options are honest about sending nothing; when a
 * real one is added it slots in here and no calling code changes.
 */

/** Prints what would be sent, including the rendered text. Development only. */
function createConsoleNotificationProvider(): NotificationProvider {
  return {
    id: 'console',
    channels: ['IN_APP', 'PUSH', 'EMAIL'] as const,
    isStub: true,

    async send(payload: NotificationPayload): Promise<NotificationResult> {
      // Deliberately console, not `logger`: the logger redacts titles and bodies
      // because a log drain is the wrong place for them. This provider exists
      // precisely to read them, so it must never be selected outside dev — see
      // `resolve()` below.
      console.info(
        `[notification:${payload.channel}] ${payload.title}\n${payload.body}${
          payload.url ? `\n→ ${payload.url}` : ''
        }`,
      )
      return { externalId: null, accepted: true }
    },
  }
}

export interface NotificationsStatus {
  providerId: string
  isStub: boolean
  channels: readonly NotificationChannel[]
  /** Channels that reach the member outside the app. Empty while stubbed. */
  externalChannels: readonly NotificationChannel[]
}

let cached: NotificationProvider | null = null

function resolve(): NotificationProvider {
  const env = serverEnv()

  if (env.NOTIFICATIONS_PROVIDER === 'console') {
    if (env.NODE_ENV === 'production') {
      // Printing message bodies to a production log is a privacy problem, not a
      // configuration preference. Downgrade rather than obey.
      logger.warn('notifications.console_refused_in_production')
      return createStubNotificationProvider()
    }
    return createConsoleNotificationProvider()
  }

  return createStubNotificationProvider()
}

export function getNotificationProvider(): NotificationProvider {
  cached ??= resolve()
  return cached
}

export function getNotificationsStatus(): NotificationsStatus {
  const provider = getNotificationProvider()
  return {
    providerId: provider.id,
    isStub: provider.isStub,
    channels: provider.channels,
    // Nothing actually leaves the system yet. The settings UI reads this to
    // avoid promising email reminders that no one will receive.
    externalChannels: provider.isStub ? [] : provider.channels.filter((c) => c !== 'IN_APP'),
  }
}

/** Test seam. `null` restores environment-driven resolution. */
export function setNotificationProvider(provider: NotificationProvider | null) {
  cached = provider
}

export type { NotificationPayload, NotificationProvider, NotificationResult }
