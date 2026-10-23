import 'server-only'

import type { Prisma } from '@prisma/client'

import { logger } from '@/lib/logger'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import {
  mergeNotificationPreferences,
  parseNotificationPreferences,
  serialiseNotificationPreferences,
  type NotificationPreferences,
  type NotificationPreferencesInput,
} from '@/server/modules/notifications/preferences'
import { writeAudit } from '@/server/services/audit'

/** Read and write a member's notification preferences. */

export async function updateNotificationPreferences(
  actor: Actor,
  input: NotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const existing = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    select: { notificationPrefs: true },
  })

  const merged = mergeNotificationPreferences(
    parseNotificationPreferences(existing?.notificationPrefs),
    input,
  )

  const notificationPrefs = serialiseNotificationPreferences(merged) as Prisma.InputJsonValue

  // Upsert rather than update: a member can reach settings before onboarding
  // has created their preference row.
  await prisma.userPreference.upsert({
    where: { userId: actor.userId },
    create: { userId: actor.userId, notificationPrefs },
    update: { notificationPrefs },
  })

  await writeAudit({
    actorId: actor.userId,
    action: 'NOTIFICATION_PREFERENCES_UPDATED',
    entityType: 'UserPreference',
    entityId: actor.userId,
    // Whether they muted everything is worth knowing when a member says "you
    // never told me my card failed". Which types they chose is not our business.
    metadata: { allMuted: merged.allMuted, hasQuietHours: merged.quietHours !== null },
  })

  logger.info('notifications.preferences.updated')

  return merged
}
