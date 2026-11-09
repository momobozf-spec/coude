import * as adhan from 'adhan'
import type { CalculationMethod, HighLatitudeRule, Madhab, Prayer } from '@/lib/prayer/types'
import { PRAYER_ORDER } from '@/lib/prayer/types'
import { isoDateToUtcDate, type IsoDate } from '@/lib/dates'

/**
 * Prayer time calculation.
 *
 * Deliberately a pure function with no I/O: no API, no keys, no rate limits, and
 * fully unit-testable against published timetables. Runs identically on the server
 * (dashboard render) and the client (live countdown).
 */

export interface PrayerTimesInput {
  latitude: number
  longitude: number
  /** Calendar day, in the user's timezone. */
  date: IsoDate
  method: CalculationMethod
  madhab: Madhab
  highLatitudeRule?: HighLatitudeRule | null
  /** Per-prayer manual correction in minutes, e.g. `{ fajr: -2, isha: 3 }`. */
  offsets?: Partial<Record<Lowercase<Prayer>, number>>
}

export interface PrayerTime {
  prayer: Prayer
  /** The instant this prayer begins. */
  time: Date
}

export interface PrayerTimesResult {
  date: IsoDate
  times: PrayerTime[]
  /** Convenience lookup by prayer name. */
  byPrayer: Record<Prayer, Date>
  sunrise: Date
}

function resolveMethod(method: CalculationMethod): adhan.CalculationParameters {
  switch (method) {
    case 'EGYPTIAN':
      return adhan.CalculationMethod.Egyptian()
    case 'KARACHI':
      return adhan.CalculationMethod.Karachi()
    case 'UMM_AL_QURA':
      return adhan.CalculationMethod.UmmAlQura()
    case 'DUBAI':
      return adhan.CalculationMethod.Dubai()
    case 'MOON_SIGHTING_COMMITTEE':
      return adhan.CalculationMethod.MoonsightingCommittee()
    case 'NORTH_AMERICA':
      return adhan.CalculationMethod.NorthAmerica()
    case 'KUWAIT':
      return adhan.CalculationMethod.Kuwait()
    case 'QATAR':
      return adhan.CalculationMethod.Qatar()
    case 'SINGAPORE':
      return adhan.CalculationMethod.Singapore()
    case 'TEHRAN':
      return adhan.CalculationMethod.Tehran()
    case 'TURKEY':
      return adhan.CalculationMethod.Turkey()
    case 'MUSLIM_WORLD_LEAGUE':
    default:
      return adhan.CalculationMethod.MuslimWorldLeague()
  }
}

type AdhanHighLatitudeRule = adhan.CalculationParameters['highLatitudeRule']

function resolveHighLatitudeRule(rule: HighLatitudeRule): AdhanHighLatitudeRule {
  switch (rule) {
    case 'SEVENTH_OF_THE_NIGHT':
      return adhan.HighLatitudeRule.SeventhOfTheNight
    case 'TWILIGHT_ANGLE':
      return adhan.HighLatitudeRule.TwilightAngle
    case 'MIDDLE_OF_THE_NIGHT':
    default:
      return adhan.HighLatitudeRule.MiddleOfTheNight
  }
}

function shift(time: Date, minutes: number | undefined): Date {
  if (!minutes) return time
  return new Date(time.getTime() + minutes * 60_000)
}

export function computePrayerTimes(input: PrayerTimesInput): PrayerTimesResult {
  const coordinates = new adhan.Coordinates(input.latitude, input.longitude)
  const params = resolveMethod(input.method)

  params.madhab = input.madhab === 'HANAFI' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi

  if (input.highLatitudeRule) {
    params.highLatitudeRule = resolveHighLatitudeRule(input.highLatitudeRule)
  } else if (Math.abs(input.latitude) >= 48) {
    // Brussels, Amsterdam, London and most of northern Europe sit here. Without a
    // rule, Fajr and Isha drift to absurd times (or vanish) in summer.
    params.highLatitudeRule = adhan.HighLatitudeRule.MiddleOfTheNight
  }

  // Inside the polar circles the sun may not set at all, and adhan's default
  // (`Unresolved`) then returns Invalid Date for Fajr, Maghrib and Isha — the
  // high-latitude rule alone does NOT cover this. `AqrabBalad` substitutes the
  // nearest latitude at which the times are resolvable, which is the position
  // most widely followed in Nordic communities.
  params.polarCircleResolution = adhan.PolarCircleResolution.AqrabBalad

  // adhan resolves times from the calendar date; UTC midnight of that day is the
  // correct, timezone-independent anchor.
  const anchor = isoDateToUtcDate(input.date)
  const times = new adhan.PrayerTimes(coordinates, anchor, params)

  const offsets = input.offsets ?? {}

  const byPrayer: Record<Prayer, Date> = {
    FAJR: shift(times.fajr, offsets.fajr),
    DHUHR: shift(times.dhuhr, offsets.dhuhr),
    ASR: shift(times.asr, offsets.asr),
    MAGHRIB: shift(times.maghrib, offsets.maghrib),
    ISHA: shift(times.isha, offsets.isha),
  }

  return {
    date: input.date,
    times: PRAYER_ORDER.map((prayer) => ({ prayer, time: byPrayer[prayer] })),
    byPrayer,
    sunrise: times.sunrise,
  }
}

export interface NextPrayerResult {
  /** The upcoming prayer. */
  prayer: Prayer
  time: Date
  /** Milliseconds until it begins. */
  msRemaining: number
  /** The prayer whose window we are currently inside, if any. */
  current: Prayer | null
  currentStartedAt: Date | null
  /** 0–100 progress through the current prayer window. */
  windowProgress: number
  /** True when the next prayer is Fajr of the following day. */
  isTomorrow: boolean
}

/**
 * Determine the next prayer relative to `now`.
 *
 * `tomorrow` is required so that after Isha we can correctly point at tomorrow's
 * Fajr rather than wrapping to today's — which would produce a negative countdown.
 */
export function getNextPrayer(
  today: PrayerTimesResult,
  tomorrow: PrayerTimesResult,
  now: Date = new Date(),
): NextPrayerResult {
  const nowMs = now.getTime()

  for (let i = 0; i < today.times.length; i++) {
    const entry = today.times[i]
    if (!entry) continue

    if (entry.time.getTime() > nowMs) {
      const previous = i > 0 ? today.times[i - 1] : null
      const currentStartedAt = previous?.time ?? null
      const windowProgress = currentStartedAt
        ? progressBetween(currentStartedAt, entry.time, now)
        : 0

      return {
        prayer: entry.prayer,
        time: entry.time,
        msRemaining: entry.time.getTime() - nowMs,
        current: previous?.prayer ?? null,
        currentStartedAt,
        windowProgress,
        isTomorrow: false,
      }
    }
  }

  // Past Isha — the next prayer is tomorrow's Fajr.
  const fajr = tomorrow.byPrayer.FAJR
  const ishaToday = today.byPrayer.ISHA

  return {
    prayer: 'FAJR',
    time: fajr,
    msRemaining: fajr.getTime() - nowMs,
    current: 'ISHA',
    currentStartedAt: ishaToday,
    windowProgress: progressBetween(ishaToday, fajr, now),
    isTomorrow: true,
  }
}

function progressBetween(start: Date, end: Date, now: Date): number {
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0
  const elapsed = now.getTime() - start.getTime()
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}
