import 'server-only'

import type { Notification, NotificationEvent } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { ownedBy } from '@/server/auth/scope'

/** De inbox toont alleen in-app-rijen; e-mailkopieën zijn verzendlog, geen melding. */
function inbox(actor: Actor): { userId: string; channel: 'IN_APP' } {
  return { ...ownedBy(actor), channel: 'IN_APP' }
}
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { NotificationNotFoundError } from '@/server/modules/reminders/errors'

/**
 * The in-app notification centre (§18, §19).
 *
 * Notifications are personal, like reminders: household membership grants no
 * access. Reading is scoped with `ownedBy`, and every mutation is scoped in the
 * `where` clause itself rather than checked afterwards, so a crafted id cannot
 * mark somebody else's notification as read.
 *
 * Nothing is destroyed — archiving hides a notification while keeping the
 * delivery record intact.
 */

export interface NotificationView {
  id: string
  event: NotificationEvent
  title: string
  body: string | null
  href: string | null
  status: Notification['status']
  readAt: Date | null
  archivedAt: Date | null
  occurrenceAt: Date | null
  reminderId: string | null
  createdAt: Date
}

function toView(row: Notification): NotificationView {
  return {
    id: row.id,
    event: row.event,
    title: row.title,
    body: row.body,
    href: row.href,
    status: row.status,
    readAt: row.readAt,
    archivedAt: row.archivedAt,
    occurrenceAt: row.occurrenceAt,
    reminderId: row.reminderId,
    createdAt: row.createdAt,
  }
}

export interface NotificationFeed {
  notifications: NotificationView[]
  unreadCount: number
}

export async function listNotifications(
  actor: Actor,
  options: { includeArchived?: boolean; limit?: number } = {},
): Promise<NotificationFeed> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        ...inbox(actor),
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
    }),
    countUnread(actor),
  ])

  return { notifications: rows.map(toView), unreadCount }
}

export async function countUnread(actor: Actor): Promise<number> {
  return prisma.notification.count({
    where: { ...inbox(actor), readAt: null, archivedAt: null },
  })
}

/**
 * Mark one notification read.
 *
 * The update is scoped by `userId` in the same statement, so there is no window
 * between checking ownership and writing.
 */
export async function markRead(actor: Actor, id: string): Promise<NotificationView> {
  const result = await prisma.notification.updateMany({
    where: { id, ...inbox(actor), readAt: null },
    data: { readAt: new Date(), status: 'READ' },
  })

  const row = await prisma.notification.findFirst({ where: { id, ...inbox(actor) } })
  if (!row) throw new NotificationNotFoundError()

  // Only audit an actual transition — re-opening a read notification is not an event.
  if (result.count > 0) {
    await recordAudit({
      userId: actor.userId,
      action: 'NOTIFICATION_READ',
      entityType: 'Notification',
      entityId: id,
      metadata: { event: row.event },
    })

    trackEvent('NOTIFICATION_OPENED', actor.userId, { notificationEvent: row.event })
  }

  return toView(row)
}

export async function markAllRead(actor: Actor): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { ...inbox(actor), readAt: null, archivedAt: null },
    data: { readAt: new Date(), status: 'READ' },
  })

  return result.count
}

export async function archiveNotification(
  actor: Actor,
  id: string,
): Promise<NotificationView> {
  const result = await prisma.notification.updateMany({
    where: { id, ...inbox(actor) },
    data: { archivedAt: new Date() },
  })

  if (result.count === 0) throw new NotificationNotFoundError()

  const row = await prisma.notification.findFirstOrThrow({
    where: { id, ...inbox(actor) },
  })

  return toView(row)
}
