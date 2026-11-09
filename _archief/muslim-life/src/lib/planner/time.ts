/**
 * Wall-clock time utilities for the planner.
 *
 * Planner blocks are stored as `localDate` + "HH:mm" strings rather than as
 * instants. That is deliberate: a block at 09:00 stays at 09:00 when the clocks
 * change, which is what a user means by "my morning focus block". Converting to
 * instants happens only where an actual moment is needed (prayer overlap), and
 * then via the day's calculated prayer times.
 */

export type ClockTime = string // "HH:mm"

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidClockTime(value: string): value is ClockTime {
  return CLOCK_PATTERN.test(value)
}

/** Minutes since local midnight. Throws on malformed input — callers validate first. */
export function toMinutes(time: ClockTime): number {
  const match = CLOCK_PATTERN.exec(time)
  if (!match) throw new RangeError(`Invalid time: ${time}`)
  return Number(match[1]) * 60 + Number(match[2])
}

export function fromMinutes(minutes: number): ClockTime {
  const normalised = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalised / 60)
  const mins = normalised % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function addMinutes(time: ClockTime, delta: number): ClockTime {
  return fromMinutes(toMinutes(time) + delta)
}

/** Duration in minutes. Negative when `end` precedes `start`. */
export function durationMinutes(start: ClockTime, end: ClockTime): number {
  return toMinutes(end) - toMinutes(start)
}

export interface TimeRange {
  startTime: ClockTime
  endTime: ClockTime
}

/**
 * Do two ranges overlap?
 *
 * Touching edges do not overlap: a block ending at 10:00 and one starting at
 * 10:00 are adjacent, not conflicting.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)
}

/** Is a single instant-of-day inside a range? Start is inclusive, end exclusive. */
export function timeWithinRange(time: ClockTime, range: TimeRange): boolean {
  const minutes = toMinutes(time)
  return minutes >= toMinutes(range.startTime) && minutes < toMinutes(range.endTime)
}

/**
 * Render an instant as "HH:mm" in a given timezone.
 * Used to place calculated prayer times onto the local-day timeline.
 */
export function instantToClockTime(instant: Date, timezone: string): ClockTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant)
  // en-GB can render midnight as "24:00"; normalise it.
  return parts === '24:00' ? '00:00' : parts
}

export const TIME_OF_DAY_BOUNDARIES = {
  /** Afternoon begins at Dhuhr in practice, but a fallback is needed before
   *  prayer times are known (no location set yet). */
  morningEnds: '12:00' as ClockTime,
  afternoonEnds: '17:00' as ClockTime,
} as const

export type DayPart = 'MORNING' | 'AFTERNOON' | 'EVENING'

/**
 * Minutes from the start of the day being displayed.
 *
 * Values of 1440 or more mean "after local midnight, but still part of this
 * day" — which genuinely happens: at the summer solstice in Brussels, Isha falls
 * at roughly 01:45 the following calendar day. Sorting such an entry by its raw
 * "01:45" would place Isha above Fajr at the top of the day, every summer, in
 * our primary market.
 */
export function timelineMinutes(time: ClockTime, afterMidnight = false): number {
  return toMinutes(time) + (afterMidnight ? 1440 : 0)
}

/**
 * Which part of the day a wall-clock time belongs to.
 *
 * When prayer times are available the boundaries follow Dhuhr and Maghrib, which
 * matches how the day is actually experienced. Without a location we fall back to
 * fixed clock hours rather than guessing.
 *
 * @param minutes Result of {@link timelineMinutes} — may exceed 1440.
 */
export function dayPartForMinutes(
  minutes: number,
  anchors?: { dhuhr?: ClockTime; maghrib?: ClockTime },
): DayPart {
  // Anything past local midnight belongs to the end of the evening, never to
  // the next morning.
  if (minutes >= 1440) return 'EVENING'

  const morningEnd = toMinutes(anchors?.dhuhr ?? TIME_OF_DAY_BOUNDARIES.morningEnds)
  const afternoonEnd = toMinutes(anchors?.maghrib ?? TIME_OF_DAY_BOUNDARIES.afternoonEnds)

  if (minutes < morningEnd) return 'MORNING'
  if (minutes < afternoonEnd) return 'AFTERNOON'
  return 'EVENING'
}

export function dayPartFor(
  time: ClockTime,
  anchors?: { dhuhr?: ClockTime; maghrib?: ClockTime },
): DayPart {
  return dayPartForMinutes(toMinutes(time), anchors)
}
