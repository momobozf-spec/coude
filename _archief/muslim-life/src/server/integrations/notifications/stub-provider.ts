import type { NotificationChannel } from '@prisma/client'

import { logger } from '@/lib/logger'
import {
  NotificationProviderError,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationResult,
} from '@/server/integrations/notifications/types'

/**
 * Stub delivery.
 *
 * Nothing leaves the system. `IN_APP` genuinely succeeds — the notification row
 * *is* the delivery — while `EMAIL` and `PUSH` are recorded as sent without a
 * message being sent anywhere.
 *
 * That last part is a deliberate lie confined to one file, and the UI is
 * required to label it: `isStub` is true, the delivery row carries
 * `provider: 'stub'`, and the notification settings page says no external
 * channel is connected. What must never happen is a member believing an email
 * reminder is on its way because a green tick appeared.
 */

interface SentRecord extends NotificationPayload {
  at: Date
}

/** In-memory record of what would have been sent. Test and dev inspection only. */
const sent: SentRecord[] = []

export function createStubNotificationProvider(): NotificationProvider {
  return {
    id: 'stub',
    channels: ['IN_APP', 'PUSH', 'EMAIL'] as const,
    isStub: true,

    async send(payload: NotificationPayload): Promise<NotificationResult> {
      if (payload.channel === 'EMAIL' && !payload.destination?.email) {
        // Still validated, so the caller's wiring is exercised exactly as it
        // would be against a real provider.
        throw new NotificationProviderError(
          'INVALID_DESTINATION',
          'An email delivery needs an address.',
        )
      }
      if (payload.channel === 'PUSH' && !payload.destination?.pushToken) {
        throw new NotificationProviderError(
          'INVALID_DESTINATION',
          'A push delivery needs a device token.',
        )
      }

      sent.push({ ...payload, at: new Date() })

      logger.debug('notifications.stub.send', {
        channel: payload.channel,
        // No title, no body, no address: the point of the stub is the wiring.
        idempotencyKey: payload.idempotencyKey,
      })

      return { externalId: `stub_${payload.idempotencyKey}`, accepted: true }
    },
  }
}

/** What the stub "sent", newest last. */
export function stubSentNotifications(channel?: NotificationChannel): readonly SentRecord[] {
  return channel ? sent.filter((record) => record.channel === channel) : sent
}

export function resetStubNotifications(): void {
  sent.length = 0
}
