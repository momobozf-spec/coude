import { describe, expect, it } from 'vitest'

import { parseQuickAdd } from '@/lib/planner/quick-add'

// 2026-08-07 is a Friday.
const TODAY = '2026-08-07'

describe('quick add — plain text', () => {
  it('keeps a plain title unscheduled, so it lands in the Inbox', () => {
    const result = parseQuickAdd('Book dentist appointment', TODAY)

    expect(result.title).toBe('Book dentist appointment')
    expect(result.scheduledDate).toBeNull()
    expect(result.scheduledTime).toBeNull()
    expect(result.priority).toBe('NORMAL')
  })

  it('never returns an empty title', () => {
    // Even if every token is consumed, something must remain to show the user.
    const result = parseQuickAdd('tomorrow', TODAY)
    expect(result.title.length).toBeGreaterThan(0)
  })
})

describe('quick add — Dutch', () => {
  it('parses the example from the brief', () => {
    const result = parseQuickAdd('Bel boekhouder morgen om 10:00', TODAY)

    expect(result.title).toBe('Bel boekhouder')
    expect(result.scheduledDate).toBe('2026-08-08')
    expect(result.scheduledTime).toBe('10:00')
  })

  it('understands vandaag and overmorgen', () => {
    expect(parseQuickAdd('Boodschappen vandaag', TODAY).scheduledDate).toBe(TODAY)
    expect(parseQuickAdd('Auto wassen overmorgen', TODAY).scheduledDate).toBe('2026-08-09')
  })

  it('understands Dutch weekdays', () => {
    // The next Monday after Friday 7 August is 10 August.
    expect(parseQuickAdd('Vergadering maandag', TODAY).scheduledDate).toBe('2026-08-10')
  })

  it('understands the 10u30 shorthand', () => {
    const result = parseQuickAdd('Afspraak 10u30', TODAY)

    expect(result.scheduledTime).toBe('10:30')
    expect(result.title).toBe('Afspraak')
  })

  it('handles bare 14u', () => {
    expect(parseQuickAdd('Call 14u', TODAY).scheduledTime).toBe('14:00')
  })
})

describe('quick add — English', () => {
  it('parses tomorrow with a time', () => {
    const result = parseQuickAdd('Call accountant tomorrow at 10:00', TODAY)

    expect(result.title).toBe('Call accountant')
    expect(result.scheduledDate).toBe('2026-08-08')
    expect(result.scheduledTime).toBe('10:00')
  })

  it('parses 12-hour times', () => {
    expect(parseQuickAdd('Gym at 5pm', TODAY).scheduledTime).toBe('17:00')
    expect(parseQuickAdd('Fajr 4am', TODAY).scheduledTime).toBe('04:00')
    expect(parseQuickAdd('Lunch 12pm', TODAY).scheduledTime).toBe('12:00')
    expect(parseQuickAdd('Suhoor 12am', TODAY).scheduledTime).toBe('00:00')
  })

  it('resolves a weekday to its next occurrence, never today', () => {
    // Today is Friday; "friday" means next Friday.
    expect(parseQuickAdd('Khutbah notes friday', TODAY).scheduledDate).toBe('2026-08-14')
  })
})

describe('quick add — dates', () => {
  it('parses an ISO date', () => {
    const result = parseQuickAdd('Submit tax return 2026-09-30', TODAY)

    expect(result.scheduledDate).toBe('2026-09-30')
    expect(result.title).toBe('Submit tax return')
  })

  it('parses day-first European dates', () => {
    expect(parseQuickAdd('Insurance 14/08', TODAY).scheduledDate).toBe('2026-08-14')
    expect(parseQuickAdd('Insurance 14-08-2027', TODAY).scheduledDate).toBe('2027-08-14')
  })

  it('ignores an impossible date rather than inventing one', () => {
    const result = parseQuickAdd('Nonsense 31/02', TODAY)
    expect(result.scheduledDate).toBeNull()
  })
})

describe('quick add — time implies today', () => {
  it('schedules a bare time for today', () => {
    const result = parseQuickAdd('Standup 09:30', TODAY)

    expect(result.scheduledDate).toBe(TODAY)
    expect(result.scheduledTime).toBe('09:30')
  })
})

describe('quick add — priority', () => {
  it('reads !! as high priority', () => {
    const result = parseQuickAdd('Finish proposal !!', TODAY)

    expect(result.priority).toBe('HIGH')
    expect(result.title).toBe('Finish proposal')
  })

  it('reads !low as low priority', () => {
    const result = parseQuickAdd('Tidy desk !low', TODAY)

    expect(result.priority).toBe('LOW')
    expect(result.title).toBe('Tidy desk')
  })

  it('defaults to normal', () => {
    expect(parseQuickAdd('Something ordinary', TODAY).priority).toBe('NORMAL')
  })
})

describe('quick add — determinism', () => {
  it('produces the same result for the same input every time', () => {
    // The reason this is rule-based rather than an LLM call.
    const first = parseQuickAdd('Bel boekhouder morgen om 10:00', TODAY)
    const second = parseQuickAdd('Bel boekhouder morgen om 10:00', TODAY)

    expect(first).toEqual(second)
  })

  it('resolves "tomorrow" against the caller-supplied local day', () => {
    // A user in Auckland whose local day is already the 8th must get the 9th.
    expect(parseQuickAdd('Task tomorrow', '2026-08-08').scheduledDate).toBe('2026-08-09')
    expect(parseQuickAdd('Task tomorrow', '2026-12-31').scheduledDate).toBe('2027-01-01')
  })
})
