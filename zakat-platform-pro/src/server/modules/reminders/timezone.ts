/**
 * Timezone arithmetic (§7, §24).
 *
 * The rule this file exists to keep: a reminder set for 09:00 local fires at
 * 09:00 local, before *and* after a DST change. That is impossible with fixed
 * offsets — "UTC+2" is only true for half the year in Brussels — so nothing here
 * does offset arithmetic by hand. Every conversion goes through
 * `Intl.DateTimeFormat`, which carries the real IANA rules including historical
 * ones.
 *
 * Pure: the reference instant is always an argument.
 */

export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`"${timezone}" is geen geldige tijdzone.`)
    this.name = 'InvalidTimezoneError'
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export function assertValidTimezone(timezone: string): void {
  if (!isValidTimezone(timezone)) throw new InvalidTimezoneError(timezone)
}

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** The wall-clock reading an instant shows in a zone. */
export function toWallClock(instant: Date, timezone: string): WallClock {
  assertValidTimezone(timezone)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  }
}

/** The zone's UTC offset in minutes at a given instant. */
export function offsetMinutesAt(instant: Date, timezone: string): number {
  const wall = toWallClock(instant, timezone)

  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  // Round to the minute: seconds are dropped from the wall reading, and some
  // historical zones have sub-minute offsets that would otherwise skew this.
  return Math.round((asUtc - floorToMinute(instant).getTime()) / 60_000)
}

function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000)
}

/**
 * Wall-clock time in a zone → the UTC instant.
 *
 * Two passes: guess with an offset taken near the target, then re-read the
 * offset at the guessed instant and correct. That converges because the offset
 * only changes at DST boundaries, and the second pass is evaluated on the
 * correct side of one.
 *
 * DST edge cases are resolved explicitly rather than left to chance:
 *
 *   • **Spring forward** — 02:30 simply does not exist on the changeover day.
 *     The requested time is pushed forward past the gap, so a 02:30 reminder
 *     fires at 03:00 rather than silently landing an hour early.
 *   • **Fall back** — 02:30 happens twice. The *earlier* occurrence is chosen,
 *     so a reminder never appears to run late.
 */
export function fromWallClock(wall: WallClock, timezone: string): Date {
  assertValidTimezone(timezone)

  const desiredUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)

  // Bracket any transition: sampling a day either side of the target guarantees
  // both the pre- and post-change offsets, whichever way the clocks moved.
  const offsetBefore = offsetMinutesAt(new Date(desiredUtc - 86_400_000), timezone)
  const offsetAfter = offsetMinutesAt(new Date(desiredUtc + 86_400_000), timezone)

  const candidates = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => new Date(desiredUtc - offset * 60_000))
    .filter((candidate) => readsBackAs(candidate, wall, timezone))
    .sort((a, b) => a.getTime() - b.getTime())

  // One match: an ordinary time. Two: the fall-back hour happened twice, and we
  // take the earlier, so a reminder never appears to run late.
  if (candidates.length > 0) return candidates[0] as Date

  // No match: a spring-forward gap, where the requested time never occurs.
  return startOfGapEnd(wall, timezone, new Date(desiredUtc - offsetBefore * 60_000))
}

function readsBackAs(instant: Date, wall: WallClock, timezone: string): boolean {
  const actual = toWallClock(instant, timezone)
  return (
    actual.year === wall.year &&
    actual.month === wall.month &&
    actual.day === wall.day &&
    actual.hour === wall.hour &&
    actual.minute === wall.minute
  )
}

/**
 * Resolve a wall time that falls inside a DST gap.
 *
 * A reminder set for 02:30 on a spring-forward day should fire the moment the
 * clocks reach the other side of the gap — 03:00 — not an hour later at 03:30.
 * So this walks *backwards* from a candidate that is past the gap to find the
 * transition edge: the earliest instant whose local reading is already at or
 * beyond the requested time, while the minute before it is still short of it.
 */
function startOfGapEnd(wall: WallClock, timezone: string, candidate: Date): Date {
  const requested = wall.hour * 60 + wall.minute

  const localMinutes = (instant: Date): number | null => {
    const actual = toWallClock(instant, timezone)
    const sameDay =
      actual.year === wall.year && actual.month === wall.month && actual.day === wall.day
    return sameDay ? actual.hour * 60 + actual.minute : null
  }

  let edge = candidate

  // Three hours is longer than any real transition, so this always terminates
  // at the boundary rather than on the guard.
  for (let step = 0; step <= 180; step += 1) {
    const probe = new Date(candidate.getTime() - step * 60_000)
    const current = localMinutes(probe)

    if (current === null || current < requested) break

    edge = probe
  }

  return edge
}

/** Parse "HH:mm" into hour and minute. */
export function parseLocalTime(localTime: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(localTime.trim())
  if (!match) {
    throw new InvalidTimezoneError(`Ongeldige tijd "${localTime}", verwacht formaat HH:mm.`)
  }
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/**
 * Build the UTC instant for a given local date and wall time.
 *
 * `day` is clamped to the last day of the month, which is what makes a "31st of
 * the month" reminder land on 28/29 February rather than skipping or rolling
 * into March (§25).
 */
export function instantForLocalDate(
  year: number,
  month: number,
  day: number,
  localTime: string,
  timezone: string,
): Date {
  const { hour, minute } = parseLocalTime(localTime)
  const clampedDay = Math.min(day, daysInMonth(year, month))

  return fromWallClock({ year, month, day: clampedDay, hour, minute }, timezone)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
