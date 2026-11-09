import { describe, expect, it } from 'vitest'

import {
  formatIntervals,
  formatWeek,
  getBusinessOpenState,
  isEmptyHours,
  parseOpeningHours,
  type OpeningHours,
} from '@/lib/business/opening-hours'

/**
 * 2026-08-07 is a Friday. All instants below are UTC; the assertions are about
 * what they mean in the *business's* timezone, which is the whole point.
 */

const RETAIL: OpeningHours = {
  mon: [['10:00', '18:30']],
  tue: [['10:00', '18:30']],
  wed: [['10:00', '18:30']],
  thu: [['10:00', '18:30']],
  fri: [['10:00', '12:15'], ['14:15', '19:00']],
  sat: [['10:00', '18:00']],
  sun: [],
}

/** Crosses midnight — the case a naive start/end comparison gets wrong. */
const LATE_NIGHT: OpeningHours = {
  mon: [['17:00', '01:00']],
  tue: [['17:00', '01:00']],
  wed: [['17:00', '01:00']],
  thu: [['17:00', '02:00']],
  fri: [['17:00', '03:00']],
  sat: [['17:00', '03:00']],
  sun: [['17:00', '00:30']],
}

const BRUSSELS = 'Europe/Brussels'

describe('parseOpeningHours', () => {
  it('accepts a well-formed record', () => {
    const parsed = parseOpeningHours(RETAIL)

    expect(parsed).not.toBeNull()
    expect(parsed!.fri).toHaveLength(2)
  })

  it('returns null rather than throwing on malformed data', () => {
    // A bad row must degrade to "hours unavailable", never crash a page.
    expect(parseOpeningHours({ mon: 'nine to five' })).toBeNull()
    expect(parseOpeningHours({ mon: [['25:00', '30:00']] })).toBeNull()
    expect(parseOpeningHours('closed on Sundays')).toBeNull()
    expect(parseOpeningHours(null)).toBeNull()
  })

  it('treats an all-empty record as no hours', () => {
    expect(parseOpeningHours({})).toBeNull()
    expect(isEmptyHours(null)).toBe(true)
  })
})

describe('getBusinessOpenState — open', () => {
  it('is open in the middle of a shift', () => {
    // 12:00 UTC = 14:00 CEST on a Friday, inside the afternoon interval.
    const state = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-07T12:30:00.000Z'))

    expect(state.isOpen).toBe(true)
    expect(state.statusLabel).toContain('Open until')
    expect(state.nextChangeAt).toBeInstanceOf(Date)
  })

  it('warns when closing within the hour', () => {
    // 16:45 UTC = 18:45 CEST, fifteen minutes before the 19:00 close.
    const state = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-07T16:45:00.000Z'))

    expect(state.isOpen).toBe(true)
    expect(state.statusLabel).toBe('Closing in 15 min')
  })

  it('is open at the exact opening minute and closed at the exact closing minute', () => {
    // Start inclusive, end exclusive.
    const opening = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-07T08:00:00.000Z'))
    expect(opening.isOpen).toBe(true)

    const closing = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-07T17:00:00.000Z'))
    expect(closing.isOpen).toBe(false)
  })
})

describe('getBusinessOpenState — closed', () => {
  it('is closed during the Jumu’ah break', () => {
    // 11:00 UTC = 13:00 CEST, between 12:15 and 14:15 on a Friday.
    const state = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-07T11:00:00.000Z'))

    expect(state.isOpen).toBe(false)
    expect(state.statusLabel).toContain('Opens')
  })

  it('is closed on a day with no intervals and points at the next open day', () => {
    // Sunday 2026-08-09, retail is closed all day.
    const state = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-09T12:00:00.000Z'))

    expect(state.isOpen).toBe(false)
    expect(state.statusLabel).toContain('tomorrow')
  })

  it('reports minutes when opening soon', () => {
    // 07:30 UTC = 09:30 CEST, half an hour before a 10:00 open.
    const state = getBusinessOpenState(RETAIL, BRUSSELS, new Date('2026-08-06T07:30:00.000Z'))

    expect(state.isOpen).toBe(false)
    expect(state.statusLabel).toBe('Opens in 30 min')
  })

  it('says hours are unavailable rather than guessing', () => {
    const state = getBusinessOpenState(null, BRUSSELS, new Date('2026-08-07T12:00:00.000Z'))

    expect(state.isOpen).toBe(false)
    expect(state.statusLabel).toBe('Hours not available')
    expect(state.nextChangeAt).toBeUndefined()
  })
})

describe('getBusinessOpenState — after midnight', () => {
  it('is still open at 00:30 on an overnight shift', () => {
    // 22:30 UTC Fri = 00:30 CEST Sat. Friday's interval runs to 03:00, so the
    // business is open — a same-day-only comparison would say closed.
    const state = getBusinessOpenState(LATE_NIGHT, BRUSSELS, new Date('2026-08-07T22:30:00.000Z'))

    expect(state.isOpen).toBe(true)
  })

  it('is still open at 02:00 from the previous evening', () => {
    // 00:00 UTC Sat = 02:00 CEST Sat, inside Friday's 17:00–03:00 window.
    const state = getBusinessOpenState(LATE_NIGHT, BRUSSELS, new Date('2026-08-08T00:00:00.000Z'))

    expect(state.isOpen).toBe(true)
  })

  it('is closed after the overnight interval ends', () => {
    // 02:00 UTC Sat = 04:00 CEST, past the 03:00 close.
    const state = getBusinessOpenState(LATE_NIGHT, BRUSSELS, new Date('2026-08-08T02:00:00.000Z'))

    expect(state.isOpen).toBe(false)
    expect(state.statusLabel).toContain('Opens')
  })

  it('handles a shift ending at 00:30 on Sunday', () => {
    // 22:00 UTC Sun = 00:00 CEST Mon, inside Sunday's 17:00–00:30 interval.
    const state = getBusinessOpenState(LATE_NIGHT, BRUSSELS, new Date('2026-08-09T22:00:00.000Z'))

    expect(state.isOpen).toBe(true)
  })
})

describe('getBusinessOpenState — timezone', () => {
  const hours: OpeningHours = {
    mon: [['09:00', '17:00']],
    tue: [['09:00', '17:00']],
    wed: [['09:00', '17:00']],
    thu: [['09:00', '17:00']],
    fri: [['09:00', '17:00']],
    sat: [['09:00', '17:00']],
    sun: [['09:00', '17:00']],
  }

  it('evaluates in the business timezone, not the viewer’s', () => {
    // 08:00 UTC is 12:00 in Dubai (open) but 04:00 in New York (closed).
    const instant = new Date('2026-08-07T08:00:00.000Z')

    expect(getBusinessOpenState(hours, 'Asia/Dubai', instant).isOpen).toBe(true)
    expect(getBusinessOpenState(hours, 'America/New_York', instant).isOpen).toBe(false)
  })

  it('gives different answers for the same instant across zones', () => {
    // 20:00 UTC: 22:00 Brussels (closed), 15:00 New York (open).
    const instant = new Date('2026-08-07T20:00:00.000Z')

    expect(getBusinessOpenState(hours, BRUSSELS, instant).isOpen).toBe(false)
    expect(getBusinessOpenState(hours, 'America/New_York', instant).isOpen).toBe(true)
  })

  it('respects daylight saving in the business timezone', () => {
    // 08:00 UTC is 10:00 CEST in August but 09:00 CET in January — both open,
    // but the point is the conversion is not hard-coded to one offset.
    expect(getBusinessOpenState(hours, BRUSSELS, new Date('2026-08-07T08:00:00.000Z')).isOpen).toBe(true)
    expect(getBusinessOpenState(hours, BRUSSELS, new Date('2026-01-09T08:00:00.000Z')).isOpen).toBe(true)

    // 07:30 UTC is 09:30 CEST (open) in August but 08:30 CET (closed) in January.
    expect(getBusinessOpenState(hours, BRUSSELS, new Date('2026-08-07T07:30:00.000Z')).isOpen).toBe(true)
    expect(getBusinessOpenState(hours, BRUSSELS, new Date('2026-01-09T07:30:00.000Z')).isOpen).toBe(false)
  })
})

describe('formatWeek', () => {
  it('starts from today in the business timezone', () => {
    const week = formatWeek(RETAIL, BRUSSELS, new Date('2026-08-07T12:00:00.000Z'))

    expect(week).toHaveLength(7)
    expect(week[0]!.isToday).toBe(true)
    expect(week[0]!.label).toBe('Friday')
    expect(week[1]!.label).toBe('Saturday')
    expect(week[6]!.label).toBe('Thursday')
  })

  it('marks days with no intervals as closed', () => {
    const week = formatWeek(RETAIL, BRUSSELS, new Date('2026-08-07T12:00:00.000Z'))
    const sunday = week.find((day) => day.key === 'sun')

    expect(sunday?.closed).toBe(true)
  })

  it('returns nothing when hours are unknown', () => {
    expect(formatWeek(null, BRUSSELS)).toEqual([])
  })
})

describe('formatIntervals', () => {
  it('renders one or more intervals', () => {
    expect(formatIntervals([['10:00', '18:30']])).toBe('10:00 – 18:30')
    expect(formatIntervals([['10:00', '12:15'], ['14:15', '19:00']])).toBe(
      '10:00 – 12:15, 14:15 – 19:00',
    )
  })

  it('says Closed for an empty day', () => {
    expect(formatIntervals([])).toBe('Closed')
  })
})
