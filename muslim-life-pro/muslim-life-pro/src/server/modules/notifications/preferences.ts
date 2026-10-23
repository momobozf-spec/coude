import type { NotificationChannel } from '@prisma/client'
import { z } from 'zod'

import {
  NOTIFICATION_DEFINITIONS,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@/server/modules/notifications/catalogue'

/**
 * Notification preferences.
 *
 * Stored as JSON on `UserPreference.notificationPrefs` rather than as a table:
 * it is a small closed map read on every dispatch, always fetched whole, and
 * never queried across members. A row per (user, type, channel) would be three
 * joins for no benefit.
 *
 * The JSON is untrusted at read time — it can predate a catalogue change — so
 * everything goes through `parseNotificationPreferences`, which drops unknown
 * types and channels instead of trusting whatever is in the column.
 */

const channelSchema = z.enum(['IN_APP', 'PUSH', 'EMAIL'])

const preferenceSchema = z.object({
  /** Channels the member has switched on for this type. */
  channels: z.array(channelSchema),
})

const storedSchema = z.object({
  /**
   * A single switch for everything non-transactional. Transactional messages
   * are unaffected — silencing a failed-payment notice would be a worse
   * outcome for the member than the interruption.
   */
  allMuted: z.boolean().optional(),
  /**
   * Local-time window during which non-transactional notifications are held.
   * `null` disables the window. Stored as minutes past midnight so it survives
   * a timezone change without re-interpretation.
   */
  quietHours: z
    .object({ startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(0).max(1439) })
    .nullish(),
  types: z.record(z.string(), preferenceSchema).optional(),
})

export interface NotificationPreferences {
  allMuted: boolean
  quietHours: { startMinute: number; endMinute: number } | null
  /** Fully resolved: every catalogue type has an entry. */
  types: Record<NotificationType, readonly NotificationChannel[]>
}

function defaults(): Record<NotificationType, readonly NotificationChannel[]> {
  const out = {} as Record<NotificationType, readonly NotificationChannel[]>
  for (const definition of Object.values(NOTIFICATION_DEFINITIONS)) {
    out[definition.type] = definition.defaultChannels
  }
  return out
}

/** Read the stored JSON into a complete, validated preference set. */
export function parseNotificationPreferences(stored: unknown): NotificationPreferences {
  const parsed = storedSchema.safeParse(stored ?? {})
  const data = parsed.success ? parsed.data : {}

  const types = defaults()

  for (const [type, value] of Object.entries(data.types ?? {})) {
    // A type removed from the catalogue leaves stale JSON behind; ignore it
    // rather than resurrecting a notification nobody can turn off.
    if (!(type in NOTIFICATION_TYPES)) continue

    const definition = NOTIFICATION_DEFINITIONS[type as NotificationType]
    types[definition.type] = value.channels.filter((channel) =>
      definition.allowedChannels.includes(channel),
    )
  }

  return {
    allMuted: data.allMuted ?? false,
    quietHours: data.quietHours ?? null,
    types,
  }
}

/** The update a member may submit from the settings page. */
export const notificationPreferencesInputSchema = z.object({
  allMuted: z.boolean().optional(),
  quietHours: z
    .object({
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(0).max(1439),
    })
    .nullable()
    .optional(),
  /*
   * `partialRecord`, not `record`: a settings screen that changes one toggle
   * should send one entry. Zod's plain `record` over an enum key requires every
   * key to be present, which would force every caller to resend the whole map
   * and make a partial update impossible to express.
   */
  types: z
    .partialRecord(
      z.enum(Object.keys(NOTIFICATION_TYPES) as [NotificationType, ...NotificationType[]]),
      z.object({ channels: z.array(channelSchema) }),
    )
    .optional(),
})

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesInputSchema>

/**
 * Merge an update into what is stored, dropping channels a type does not allow.
 *
 * A client asking to receive `PRAYER_REMINDER` by email does not get an error —
 * it gets a preference set that simply does not contain that combination, which
 * is what the settings UI can express anyway.
 */
export function mergeNotificationPreferences(
  current: NotificationPreferences,
  input: NotificationPreferencesInput,
): NotificationPreferences {
  const types = { ...current.types }

  for (const [type, value] of Object.entries(input.types ?? {})) {
    const definition = NOTIFICATION_DEFINITIONS[type as NotificationType]
    types[definition.type] = (value?.channels ?? []).filter((channel) =>
      definition.allowedChannels.includes(channel),
    )
  }

  return {
    allMuted: input.allMuted ?? current.allMuted,
    quietHours: input.quietHours === undefined ? current.quietHours : input.quietHours,
    types,
  }
}

/** Shape written back to the JSON column. */
export function serialiseNotificationPreferences(
  preferences: NotificationPreferences,
): Record<string, unknown> {
  return {
    allMuted: preferences.allMuted,
    quietHours: preferences.quietHours,
    types: Object.fromEntries(
      Object.entries(preferences.types).map(([type, channels]) => [type, { channels }]),
    ),
  }
}

/** Is `minute` (local minutes past midnight) inside the quiet window? */
export function isInQuietHours(
  quietHours: { startMinute: number; endMinute: number } | null,
  minute: number,
): boolean {
  if (!quietHours) return false

  const { startMinute, endMinute } = quietHours
  if (startMinute === endMinute) return false

  // A window that wraps midnight (22:00 → 07:00) is the common case, so it is
  // handled explicitly rather than treated as an invalid range.
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute
}

/**
 * Which channels should this notification actually use?
 *
 * The single decision point. Order matters: preferences are consulted *before*
 * any provider is touched, so a muted member never becomes an outbound request.
 */
export function resolveChannels(
  type: NotificationType,
  preferences: NotificationPreferences,
  options: { localMinute?: number; availableChannels: readonly NotificationChannel[] },
): readonly NotificationChannel[] {
  const definition = NOTIFICATION_DEFINITIONS[type]

  if (!definition.transactional) {
    if (preferences.allMuted) return []
    if (
      options.localMinute !== undefined &&
      isInQuietHours(preferences.quietHours, options.localMinute)
    ) {
      return []
    }
  }

  const chosen = definition.transactional
    ? // Transactional messages ignore per-type preferences, but a member who has
      // turned a channel off for everything still should not be emailed by it
      // when in-app would do. Defaults are the floor, preferences the ceiling.
      union(definition.defaultChannels, preferences.types[type])
    : preferences.types[type]

  return chosen.filter(
    (channel) =>
      definition.allowedChannels.includes(channel) && options.availableChannels.includes(channel),
  )
}

function union<T>(a: readonly T[], b: readonly T[]): readonly T[] {
  return [...new Set([...a, ...b])]
}
