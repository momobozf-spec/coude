import 'server-only'

import type { Prayer, PrayerStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { addDays, dayOfWeek, isoDateToUtcDate, type IsoDate } from '@/lib/dates'
import { computePrayerTimes, getNextPrayer as resolveNextPrayer } from '@/lib/prayer/calculate'
import type { NextPrayerResult, PrayerTimesResult } from '@/lib/prayer/calculate'
import { COMPLETED_PRAYER_STATUSES } from '@/lib/prayer/types'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

export interface PrayerSettings {
  latitude: number
  longitude: number
  cityName: string | null
  method: Parameters<typeof computePrayerTimes>[0]['method']
  madhab: Parameters<typeof computePrayerTimes>[0]['madhab']
  highLatitudeRule: Parameters<typeof computePrayerTimes>[0]['highLatitudeRule']
  offsets: Record<string, number>
}

/**
 * Settings needed to compute prayer times.
 * `null` when no location is set — the UI then asks for one rather than showing
 * times for a place the user never chose.
 */
export async function getPrayerSettings(actor: Actor): Promise<PrayerSettings | null> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    select: {
      latitude: true,
      longitude: true,
      calculationMethod: true,
      madhab: true,
      highLatitudeRule: true,
      prayerOffsets: true,
      city: { select: { name: true } },
    },
  })

  if (!preference?.latitude || !preference.longitude) return null

  const offsets =
    preference.prayerOffsets && typeof preference.prayerOffsets === 'object'
      ? (preference.prayerOffsets as Record<string, number>)
      : {}

  return {
    latitude: preference.latitude,
    longitude: preference.longitude,
    cityName: preference.city?.name ?? null,
    method: preference.calculationMethod,
    madhab: preference.madhab,
    highLatitudeRule: preference.highLatitudeRule,
    offsets,
  }
}

export interface DayPrayerTimes {
  times: PrayerTimesResult
  next: NextPrayerResult
  /**
   * True when this local day is a Friday. Jumu'ah replaces Dhuhr rather than
   * being a sixth prayer — treating it as an extra entry would make the day read
   * as 6 prayers and double-count against Dhuhr.
   */
  isJumuah: boolean
}

export function computeForDay(
  settings: PrayerSettings,
  date: IsoDate,
  now: Date = new Date(),
): DayPrayerTimes {
  const shared = {
    latitude: settings.latitude,
    longitude: settings.longitude,
    method: settings.method,
    madhab: settings.madhab,
    highLatitudeRule: settings.highLatitudeRule,
    offsets: settings.offsets,
  }

  const times = computePrayerTimes({ ...shared, date })
  // Tomorrow is required so that after Isha the next prayer is tomorrow's Fajr
  // rather than wrapping to today's, which would give a negative countdown.
  const tomorrow = computePrayerTimes({ ...shared, date: addDays(date, 1) })

  return {
    times,
    next: resolveNextPrayer(times, tomorrow, now),
    isJumuah: dayOfWeek(date) === 5,
  }
}

export interface NextPrayerSummary {
  prayer: Prayer
  startsAt: Date
  minutesUntil: number
  isTomorrow: boolean
  /** The prayer whose window we are currently inside, if any. */
  current: Prayer | null
  /** 0–100 through the current window. */
  windowProgress: number
}

/**
 * The next prayer, as a minute-resolution summary.
 *
 * Minutes rather than milliseconds on purpose: the UI shows "in 42 minutes", so
 * the countdown re-renders once a minute instead of once a second.
 */
export function getNextPrayer(
  settings: PrayerSettings,
  date: IsoDate,
  now: Date = new Date(),
): NextPrayerSummary {
  const { next } = computeForDay(settings, date, now)

  return {
    prayer: next.prayer,
    startsAt: next.time,
    minutesUntil: Math.max(0, Math.ceil(next.msRemaining / 60_000)),
    isTomorrow: next.isTomorrow,
    current: next.current,
    windowProgress: next.windowProgress,
  }
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function getPrayerLogsForDay(
  actor: Actor,
  date: IsoDate,
): Promise<Partial<Record<Prayer, PrayerStatus>>> {
  const logs = await prisma.prayerLog.findMany({
    where: { userId: actor.userId, date: isoDateToUtcDate(date) },
    select: { prayer: true, status: true },
  })

  return Object.fromEntries(logs.map((log) => [log.prayer, log.status]))
}

/**
 * Record or clear a prayer.
 *
 * Upserted on `[userId, date, prayer]`, so repeated taps are idempotent.
 * `status: null` removes the record entirely — un-ticking is a removal, never a
 * `MISSED` row. A prayer is only `MISSED` if the user says so.
 */
export async function logPrayer(
  actor: Actor,
  date: IsoDate,
  prayer: Prayer,
  status: PrayerStatus | null,
): Promise<void> {
  const day = isoDateToUtcDate(date)

  if (status === null) {
    await prisma.prayerLog.deleteMany({ where: { userId: actor.userId, date: day, prayer } })
    return
  }

  await prisma.prayerLog.upsert({
    where: { userId_date_prayer: { userId: actor.userId, date: day, prayer } },
    create: { userId: actor.userId, date: day, prayer, status },
    update: { status, loggedAt: new Date() },
  })

  // Which prayer and whether it was excused — never a time, never a location.
  await track(actor.userId, ANALYTICS_EVENTS.PRAYER_LOGGED, {
    excused: status === 'EXCUSED',
    jamaah: status === 'JAMAAH',
  })
}

export function isCompleted(status: PrayerStatus | undefined | null): boolean {
  return status !== null && status !== undefined
    ? (COMPLETED_PRAYER_STATUSES as readonly string[]).includes(status)
    : false
}

export interface PrayerWeekCounts {
  logged: number
  excused: number
}

/**
 * Counts for the weekly review.
 *
 * `EXCUSED` is reported separately and is never folded into a "missed" figure.
 * A travelling or menstruating user must never see their week rendered as a
 * shortfall.
 */
export async function countPrayersBetween(
  actor: Actor,
  from: IsoDate,
  to: IsoDate,
): Promise<PrayerWeekCounts> {
  const range = {
    userId: actor.userId,
    date: { gte: isoDateToUtcDate(from), lte: isoDateToUtcDate(to) },
  }

  const [logged, excused] = await Promise.all([
    prisma.prayerLog.count({
      where: { ...range, status: { in: [...COMPLETED_PRAYER_STATUSES] } },
    }),
    prisma.prayerLog.count({ where: { ...range, status: 'EXCUSED' } }),
  ])

  return { logged, excused }
}
