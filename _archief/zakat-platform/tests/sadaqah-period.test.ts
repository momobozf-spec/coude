import { describe, expect, it } from 'vitest'

import { currentWindow, SADAQAH_TYPES } from '@/server/modules/donations/sadaqah-service'

/**
 * Sadaqah goal periods (§40).
 *
 * The window decides which donations count, so an off-by-one here silently
 * misreports someone's giving. Boundaries are pinned explicitly.
 */

const iso = (date: Date) => date.toISOString().slice(0, 10)

const START = new Date('2026-01-01T00:00:00.000Z')

describe('monthly window', () => {
  it('covers the calendar month containing today', () => {
    const window = currentWindow('MONTHLY', START, null, new Date('2026-08-08T12:00:00Z'))

    expect(iso(window.start)).toBe('2026-08-01')
    expect(iso(window.end)).toBe('2026-09-01')
  })

  it('moves with the reference date rather than the goal start', () => {
    // A goal created in January must measure August in August.
    const january = currentWindow('MONTHLY', START, null, new Date('2026-01-15T00:00:00Z'))
    const august = currentWindow('MONTHLY', START, null, new Date('2026-08-15T00:00:00Z'))

    expect(iso(january.start)).toBe('2026-01-01')
    expect(iso(august.start)).toBe('2026-08-01')
  })

  it('handles a December window crossing the year boundary', () => {
    const window = currentWindow('MONTHLY', START, null, new Date('2026-12-20T00:00:00Z'))

    expect(iso(window.start)).toBe('2026-12-01')
    expect(iso(window.end)).toBe('2027-01-01')
  })
})

describe('yearly window', () => {
  it('covers the calendar year', () => {
    const window = currentWindow('YEARLY', START, null, new Date('2026-08-08T00:00:00Z'))

    expect(iso(window.start)).toBe('2026-01-01')
    expect(iso(window.end)).toBe('2027-01-01')
  })
})

describe('weekly window', () => {
  it('starts on Monday', () => {
    // 2026-08-08 is a Saturday.
    const window = currentWindow('WEEKLY', START, null, new Date('2026-08-08T00:00:00Z'))

    expect(iso(window.start)).toBe('2026-08-03')
    expect(iso(window.end)).toBe('2026-08-10')
  })

  it('treats Sunday as the last day of the week, not the first', () => {
    // 2026-08-09 is a Sunday; it belongs to the week beginning 3 August.
    const window = currentWindow('WEEKLY', START, null, new Date('2026-08-09T00:00:00Z'))

    expect(iso(window.start)).toBe('2026-08-03')
  })
})

describe('daily window', () => {
  it('covers exactly one day', () => {
    const window = currentWindow('DAILY', START, null, new Date('2026-08-08T23:59:00Z'))

    expect(iso(window.start)).toBe('2026-08-08')
    expect(iso(window.end)).toBe('2026-08-09')
  })
})

describe('goal lifetime', () => {
  it('never starts before the goal did', () => {
    const start = new Date('2026-08-15T00:00:00.000Z')
    const window = currentWindow('MONTHLY', start, null, new Date('2026-08-20T00:00:00Z'))

    // A goal created mid-month measures from its own start, not from the 1st.
    expect(iso(window.start)).toBe('2026-08-15')
  })

  it('never runs past the goal end date', () => {
    const end = new Date('2026-08-20T00:00:00.000Z')
    const window = currentWindow('MONTHLY', START, end, new Date('2026-08-10T00:00:00Z'))

    expect(iso(window.end)).toBe('2026-08-20')
  })

  it('clamps to the final period once the goal has ended', () => {
    const end = new Date('2026-06-30T00:00:00.000Z')
    const window = currentWindow('MONTHLY', START, end, new Date('2026-12-01T00:00:00Z'))

    // Measuring December against a goal that ended in June would be misleading.
    expect(iso(window.start)).toBe('2026-06-01')
    expect(iso(window.end)).toBe('2026-06-30')
  })

  it('clamps to the first period before the goal has started', () => {
    const start = new Date('2026-09-01T00:00:00.000Z')
    const window = currentWindow('MONTHLY', start, null, new Date('2026-05-01T00:00:00Z'))

    expect(iso(window.start)).toBe('2026-09-01')
  })
})

describe('counted donation types', () => {
  it('includes only voluntary giving', () => {
    expect([...SADAQAH_TYPES]).toEqual(['SADAQAH', 'SADAQAH_JARIYAH'])
  })

  it('excludes Zakat, so an obligation can never satisfy a voluntary goal', () => {
    expect([...SADAQAH_TYPES]).not.toContain('ZAKAT')
    expect([...SADAQAH_TYPES]).not.toContain('FIDYA')
    expect([...SADAQAH_TYPES]).not.toContain('KAFFARAH')
  })
})
