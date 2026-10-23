import { describe, expect, it } from 'vitest'

import {
  addMinutes,
  dayPartFor,
  durationMinutes,
  fromMinutes,
  instantToClockTime,
  isValidClockTime,
  rangesOverlap,
  timeWithinRange,
  toMinutes,
} from '@/lib/planner/time'
import { findPrayerConflicts } from '@/server/modules/planner/planner-block.service'
import { computePrayerTimes } from '@/lib/prayer/calculate'

describe('clock time', () => {
  it('validates HH:mm', () => {
    expect(isValidClockTime('00:00')).toBe(true)
    expect(isValidClockTime('23:59')).toBe(true)
    expect(isValidClockTime('09:05')).toBe(true)

    expect(isValidClockTime('24:00')).toBe(false)
    expect(isValidClockTime('9:05')).toBe(false)
    expect(isValidClockTime('12:60')).toBe(false)
    expect(isValidClockTime('lunch')).toBe(false)
  })

  it('converts to and from minutes', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('23:59')).toBe(1439)

    expect(fromMinutes(0)).toBe('00:00')
    expect(fromMinutes(570)).toBe('09:30')
    expect(fromMinutes(1439)).toBe('23:59')
  })

  it('wraps when adding past midnight', () => {
    expect(addMinutes('23:30', 45)).toBe('00:15')
    expect(addMinutes('00:15', -30)).toBe('23:45')
  })

  it('measures duration and reports a negative range', () => {
    expect(durationMinutes('09:00', '11:30')).toBe(150)
    expect(durationMinutes('11:30', '09:00')).toBe(-150)
    expect(durationMinutes('09:00', '09:00')).toBe(0)
  })
})

describe('range overlap', () => {
  const block = { startTime: '14:00', endTime: '17:00' }

  it('detects a genuine overlap', () => {
    expect(rangesOverlap(block, { startTime: '16:00', endTime: '18:00' })).toBe(true)
    expect(rangesOverlap(block, { startTime: '13:00', endTime: '15:00' })).toBe(true)
    // Fully contained.
    expect(rangesOverlap(block, { startTime: '15:00', endTime: '16:00' })).toBe(true)
    // Fully containing.
    expect(rangesOverlap(block, { startTime: '10:00', endTime: '20:00' })).toBe(true)
  })

  it('treats touching edges as adjacent, not overlapping', () => {
    // A block ending at 14:00 and one starting at 14:00 are back to back.
    expect(rangesOverlap(block, { startTime: '11:00', endTime: '14:00' })).toBe(false)
    expect(rangesOverlap(block, { startTime: '17:00', endTime: '19:00' })).toBe(false)
  })

  it('places an instant inside a range, start inclusive and end exclusive', () => {
    expect(timeWithinRange('14:00', block)).toBe(true)
    expect(timeWithinRange('16:42', block)).toBe(true)
    expect(timeWithinRange('17:00', block)).toBe(false)
    expect(timeWithinRange('13:59', block)).toBe(false)
  })
})

describe('day parts', () => {
  it('falls back to clock hours with no prayer anchors', () => {
    expect(dayPartFor('08:00')).toBe('MORNING')
    expect(dayPartFor('14:00')).toBe('AFTERNOON')
    expect(dayPartFor('20:00')).toBe('EVENING')
  })

  it('uses Dhuhr and Maghrib as boundaries when known', () => {
    const anchors = { dhuhr: '13:42', maghrib: '21:04' }

    // 13:00 is still morning when Dhuhr is at 13:42 — a fixed noon boundary
    // would get this wrong in a Brussels summer.
    expect(dayPartFor('13:00', anchors)).toBe('MORNING')
    expect(dayPartFor('14:00', anchors)).toBe('AFTERNOON')
    expect(dayPartFor('20:00', anchors)).toBe('AFTERNOON')
    expect(dayPartFor('21:30', anchors)).toBe('EVENING')
  })
})

describe('instantToClockTime', () => {
  it('renders in the requested timezone, not the host timezone', () => {
    const instant = new Date('2026-08-07T12:00:00.000Z')

    expect(instantToClockTime(instant, 'UTC')).toBe('12:00')
    expect(instantToClockTime(instant, 'Europe/Brussels')).toBe('14:00') // CEST
    expect(instantToClockTime(instant, 'Asia/Dubai')).toBe('16:00')
  })
})

describe('prayer conflict detection', () => {
  const BRUSSELS = { latitude: 50.8503, longitude: 4.3517 }
  const timezone = 'Europe/Brussels'

  const times = computePrayerTimes({
    ...BRUSSELS,
    date: '2026-08-07',
    method: 'MUSLIM_WORLD_LEAGUE',
    madhab: 'SHAFI',
  })

  it('flags a prayer that starts inside a block', () => {
    // A long afternoon block in a Brussels summer will contain Asr.
    const conflicts = findPrayerConflicts(
      { startTime: '14:00', endTime: '20:00' },
      times,
      timezone,
    )

    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts.map((conflict) => conflict.prayer)).toContain('ASR')
  })

  it('offers both an end-before and a resume-after suggestion', () => {
    const conflicts = findPrayerConflicts(
      { startTime: '14:00', endTime: '20:00' },
      times,
      timezone,
    )
    const asr = conflicts.find((conflict) => conflict.prayer === 'ASR')

    expect(asr).toBeDefined()
    expect(asr!.endBefore).toBe(asr!.at)
    // Resume time is after the prayer begins.
    expect(toMinutes(asr!.resumeAfter)).toBeGreaterThan(toMinutes(asr!.at))
  })

  it('reports nothing for a block with no prayer inside it', () => {
    // The small hours contain no prayer in a Brussels summer.
    const conflicts = findPrayerConflicts(
      { startTime: '01:00', endTime: '02:00' },
      times,
      timezone,
    )

    expect(conflicts).toEqual([])
  })

  it('never reports a prayer exactly at the block end, which is exclusive', () => {
    const asrClock = instantToClockTime(times.byPrayer.ASR, timezone)
    const conflicts = findPrayerConflicts(
      { startTime: '12:00', endTime: asrClock },
      times,
      timezone,
    )

    expect(conflicts.map((conflict) => conflict.prayer)).not.toContain('ASR')
  })
})
