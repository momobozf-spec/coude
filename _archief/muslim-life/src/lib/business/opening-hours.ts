import { z } from 'zod'

import { instantToClockTime, toMinutes, type ClockTime } from '@/lib/planner/time'

/**
 * Structured opening hours.
 *
 * Stored as validated JSON rather than a relational table: hours are always read
 * as a whole with their business, never queried relationally, and a `BusinessHour`
 * table would mean seven-plus joined rows per listing on every browse query for no
 * gain. The shape is strict and parsed on every read, so a malformed record
 * degrades to "hours unavailable" instead of crashing a page.
 *
 * Multiple intervals per day are supported — a butcher closing for Jumu'ah is
 * `[["09:00","12:00"],["14:30","18:00"]]`, which a single open/close pair cannot
 * express.
 */

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
}

const clockTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)

/** `["09:00", "18:00"]`. An end earlier than the start means it runs past midnight. */
const intervalSchema = z.tuple([clockTime, clockTime])

export const openingHoursSchema = z.object({
  sun: z.array(intervalSchema).max(4).default([]),
  mon: z.array(intervalSchema).max(4).default([]),
  tue: z.array(intervalSchema).max(4).default([]),
  wed: z.array(intervalSchema).max(4).default([]),
  thu: z.array(intervalSchema).max(4).default([]),
  fri: z.array(intervalSchema).max(4).default([]),
  sat: z.array(intervalSchema).max(4).default([]),
})

export type OpeningHours = z.infer<typeof openingHoursSchema>
export type OpeningInterval = [ClockTime, ClockTime]

/** Parse stored JSON. Returns empty hours rather than throwing on bad data. */
export function parseOpeningHours(value: unknown): OpeningHours | null {
  if (value === null || value === undefined) return null

  const parsed = openingHoursSchema.safeParse(value)
  if (!parsed.success) return null

  const hasAny = DAY_KEYS.some((day) => parsed.data[day].length > 0)
  return hasAny ? parsed.data : null
}

export function isEmptyHours(hours: OpeningHours | null): boolean {
  return hours === null || DAY_KEYS.every((day) => hours[day].length === 0)
}

export interface OpenState {
  isOpen: boolean
  statusLabel: string
  /** When the state next flips — closing time if open, opening time if closed. */
  nextChangeAt?: Date
}

interface ZonedNow {
  dayIndex: number // 0 = Sunday
  minutes: number // minutes since local midnight
  date: Date
}

/** Resolve "now" into the business's own timezone. */
function zonedNow(now: Date, timezone: string): ZonedNow {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')

  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)

  return {
    // `hour` can be 24 at midnight in some locales; normalise.
    dayIndex: dayIndex < 0 ? 0 : dayIndex,
    minutes: (hour % 24) * 60 + minute,
    date: now,
  }
}

/** Shift an instant by whole minutes. */
function shift(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000)
}

interface ResolvedInterval {
  /** Minutes from the start of the reference day; may exceed 1440. */
  start: number
  end: number
}

/**
 * Intervals that could cover "now", expressed relative to today's midnight.
 *
 * Yesterday's overnight intervals are included with negative starts, because a
 * bakery open 22:00–02:00 on Saturday is genuinely open at 01:00 on Sunday.
 */
function relevantIntervals(hours: OpeningHours, dayIndex: number): ResolvedInterval[] {
  const resolved: ResolvedInterval[] = []

  const yesterdayKey = DAY_KEYS[(dayIndex + 6) % 7]!
  const todayKey = DAY_KEYS[dayIndex]!

  for (const [start, end] of hours[yesterdayKey]) {
    const startMin = toMinutes(start)
    const endMin = toMinutes(end)
    // Only overnight intervals from yesterday can still be running.
    if (endMin <= startMin) {
      resolved.push({ start: startMin - 1440, end: endMin })
    }
  }

  for (const [start, end] of hours[todayKey]) {
    const startMin = toMinutes(start)
    const endMin = toMinutes(end)
    resolved.push({ start: startMin, end: endMin <= startMin ? endMin + 1440 : endMin })
  }

  return resolved.sort((a, b) => a.start - b.start)
}

/**
 * Whether a business is open right now, and when that next changes.
 *
 * Everything is evaluated in the business's own timezone: a member in London
 * looking at a Dubai listing must see Dubai's opening state, not their own.
 */
export function getBusinessOpenState(
  hours: OpeningHours | null,
  timezone: string,
  now: Date = new Date(),
): OpenState {
  if (isEmptyHours(hours)) {
    return { isOpen: false, statusLabel: 'Hours not available' }
  }

  const current = zonedNow(now, timezone)
  const intervals = relevantIntervals(hours!, current.dayIndex)

  for (const interval of intervals) {
    if (current.minutes >= interval.start && current.minutes < interval.end) {
      const untilClose = interval.end - current.minutes
      return {
        isOpen: true,
        statusLabel:
          untilClose <= 60
            ? `Closing in ${untilClose} min`
            : `Open until ${minutesToClock(interval.end)}`,
        nextChangeAt: shift(current.date, untilClose),
      }
    }
  }

  // Closed: find the next opening, looking up to a week ahead.
  const upcoming = intervals.find((interval) => interval.start > current.minutes)
  if (upcoming) {
    const untilOpen = upcoming.start - current.minutes
    return {
      isOpen: false,
      statusLabel:
        untilOpen <= 60
          ? `Opens in ${untilOpen} min`
          : `Opens ${minutesToClock(upcoming.start)}`,
      nextChangeAt: shift(current.date, untilOpen),
    }
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const key = DAY_KEYS[(current.dayIndex + ahead) % 7]!
    const first = hours![key][0]
    if (!first) continue

    const startMin = toMinutes(first[0])
    const untilOpen = ahead * 1440 + startMin - current.minutes

    return {
      isOpen: false,
      statusLabel: ahead === 1 ? `Opens tomorrow ${first[0]}` : `Opens ${DAY_LABELS[key]} ${first[0]}`,
      nextChangeAt: shift(current.date, untilOpen),
    }
  }

  return { isOpen: false, statusLabel: 'Closed' }
}

function minutesToClock(minutes: number): ClockTime {
  const normalised = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalised / 60)
  const mins = normalised % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export interface DayHours {
  key: DayKey
  label: string
  intervals: OpeningInterval[]
  isToday: boolean
  closed: boolean
}

/** The week, ordered from today, for the detail page. */
export function formatWeek(
  hours: OpeningHours | null,
  timezone: string,
  now: Date = new Date(),
): DayHours[] {
  if (!hours) return []

  const todayIndex = zonedNow(now, timezone).dayIndex

  return Array.from({ length: 7 }, (_, offset) => {
    const index = (todayIndex + offset) % 7
    const key = DAY_KEYS[index]!
    const intervals = hours[key] as OpeningInterval[]

    return {
      key,
      label: DAY_LABELS[key],
      intervals,
      isToday: offset === 0,
      closed: intervals.length === 0,
    }
  })
}

/** Today's intervals as display text, e.g. "10:00 – 20:00". */
export function formatIntervals(intervals: OpeningInterval[]): string {
  if (intervals.length === 0) return 'Closed'
  return intervals.map(([start, end]) => `${start} – ${end}`).join(', ')
}

/** Re-exported so callers do not reach into the planner module for this. */
export { instantToClockTime }
