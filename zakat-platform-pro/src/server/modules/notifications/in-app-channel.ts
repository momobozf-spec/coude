import 'server-only'

import { Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type {
  NotificationChannelAdapter,
  NotificationDeliveryInput,
  NotificationDeliveryResult,
} from '@/server/modules/notifications/channels'

/**
 * In-app delivery — the only fully implemented channel in phase 5 (§15).
 *
 * Delivery is a row insert guarded by `@@unique([userId, dedupeKey])`. That
 * unique index, not application logic, is what makes at-least-once processing
 * safe: two workers handling the same due reminder both compute the same key,
 * one insert wins, and the loser reports `deduplicated` rather than an error
 * (§22, §23).
 */
export class InAppNotificationChannel implements NotificationChannelAdapter {
  readonly channel = 'IN_APP' as const
  readonly available = true

  async send(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          channel: 'IN_APP',
          event: input.event,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
          reminderId: input.reminderId ?? null,
          occurrenceAt: input.occurrenceAt ?? null,
          dedupeKey: input.dedupeKey ?? null,
          // In-app needs no transport, so it is delivered the moment it exists.
          status: 'SENT',
          sentAt: new Date(),
        },
      })

      return {
        channel: 'IN_APP',
        delivered: true,
        deduplicated: false,
        notificationId: notification.id,
      }
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Boolean(input.dedupeKey)

      if (!isDuplicate) throw error

      // Another worker got there first. The user has their notification, which
      // is the outcome that was asked for.
      const existing = await prisma.notification.findUnique({
        where: {
          userId_dedupeKey: {
            userId: input.userId,
            dedupeKey: input.dedupeKey as string,
          },
        },
        select: { id: true },
      })

      return {
        channel: 'IN_APP',
        delivered: false,
        deduplicated: true,
        notificationId: existing?.id,
      }
    }
  }
}
