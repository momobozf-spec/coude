import { describe, expect, it } from 'vitest'

import {
  expectedPerWeek,
  isAvailableOn,
  isScheduledOn,
  statusForQuantity,
  weeklyProgress,
  type HabitSchedule,
} from '@/lib/habits/schedule'

const daily: HabitSchedule = { frequencyType: 'DAILY', daysOfWeek: [], targetPerPeriod: 7 }
// Monday, Wednesday, Friday.
const specificDays: HabitSchedule = {
  frequencyType: 'SPECIFIC_DAYS',
  daysOfWeek: [1, 3, 5],
  targetPerPeriod: 3,
}
const timesPerWeek: HabitSchedule = {
  frequencyType: 'TIMES_PER_WEEK',
  daysOfWeek: [],
  targetPerPeriod: 4,
}

// 2026-08-03 is a Monday; 2026-08-09 is the following Sunday.
const MONDAY = '2026-08-03'
const TUESDAY = '2026-08-04'
const WEDNESDAY = '2026-08-05'
const FRIDAY = '2026-08-07'
const SUNDAY = '2026-08-09'

describe('daily habits', () => {
  it('is scheduled every day', () => {
    for (const date of [MONDAY, TUESDAY, WEDNESDAY, FRIDAY, SUNDAY]) {
      expect(isScheduledOn(daily, date)).toBe(true)
      expect(isAvailableOn(daily, date)).toBe(true)
    }
  })

  it('expects seven days a week', () => {
    expect(expectedPerWeek(daily)).toBe(7)
  })
})

describe('specific-day habits', () => {
  it('is scheduled only on its weekdays, in the local calendar', () => {
    expect(isScheduledOn(specificDays, MONDAY)).toBe(true)
    expect(isScheduledOn(specificDays, WEDNESDAY)).toBe(true)
    expect(isScheduledOn(specificDays, FRIDAY)).toBe(true)

    expect(isScheduledOn(specificDays, TUESDAY)).toBe(false)
    expect(isScheduledOn(specificDays, SUNDAY)).toBe(false)
  })

  it('is not shown on days it is not scheduled', () => {
    expect(isAvailableOn(specificDays, TUESDAY)).toBe(false)
  })

  it('expects as many days as it lists', () => {
    expect(expectedPerWeek(specificDays)).toBe(3)
  })

  it('reads weekdays from the local date, not from UTC', () => {
    // 2026-08-03 is Monday everywhere, because the schedule is evaluated against
    // the user's local calendar day rather than an instant.
    expect(isScheduledOn(specificDays, '2026-08-03')).toBe(true)
    // The Sunday before must not match.
    expect(isScheduledOn(specificDays, '2026-08-02')).toBe(false)
  })
})

describe('times-per-week habits', () => {
  it('is never "due" on a particular day', () => {
    // This is the anti-guilt rule: a 4x/week habit must not read as three
    // failures every week.
    for (const date of [MONDAY, TUESDAY, WEDNESDAY, FRIDAY, SUNDAY]) {
      expect(isScheduledOn(timesPerWeek, date)).toBe(false)
    }
  })

  it('is always available to complete', () => {
    for (const date of [MONDAY, TUESDAY, SUNDAY]) {
      expect(isAvailableOn(timesPerWeek, date)).toBe(true)
    }
  })

  it('expects its weekly target', () => {
    expect(expectedPerWeek(timesPerWeek)).toBe(4)
  })

  it('clamps an out-of-range target', () => {
    expect(expectedPerWeek({ ...timesPerWeek, targetPerPeriod: 99 })).toBe(7)
    expect(expectedPerWeek({ ...timesPerWeek, targetPerPeriod: 0 })).toBe(1)
  })
})

describe('weeklyProgress', () => {
  it('counts each status separately', () => {
    const result = weeklyProgress(daily, [
      { localDate: MONDAY, status: 'COMPLETED' },
      { localDate: TUESDAY, status: 'COMPLETED' },
      { localDate: WEDNESDAY, status: 'PARTIAL' },
      { localDate: FRIDAY, status: 'SKIPPED' },
    ])

    expect(result).toEqual({ completed: 2, partial: 1, skipped: 1, expected: 7 })
  })

  it('reports zeroes for an empty week without inventing a deficit', () => {
    expect(weeklyProgress(specificDays, [])).toEqual({
      completed: 0,
      partial: 0,
      skipped: 0,
      expected: 3,
    })
  })
})

describe('statusForQuantity', () => {
  it('is completed at or above target', () => {
    expect(statusForQuantity(5, 5)).toBe('COMPLETED')
    expect(statusForQuantity(9, 5)).toBe('COMPLETED')
  })

  it('is partial below target', () => {
    expect(statusForQuantity(3, 5)).toBe('PARTIAL')
    expect(statusForQuantity(1, 5)).toBe('PARTIAL')
  })

  it('clears the day at zero rather than recording a failure', () => {
    expect(statusForQuantity(0, 5)).toBeNull()
    expect(statusForQuantity(-2, 5)).toBeNull()
  })
})
