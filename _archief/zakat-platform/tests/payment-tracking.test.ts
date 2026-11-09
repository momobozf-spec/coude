import { describe, expect, it } from 'vitest'

import { computeTotals, deriveStatus } from '@/server/modules/donations/payment-service'
import { toMinorUnits } from '@/lib/money'

/**
 * Zakat payment tracking (§39).
 *
 * The status rule and the totals are pure, so the cases from the specification
 * are pinned here without a database. The database-backed behaviour — voided
 * donations excluded, drafts rejected, other calculations not counted — lives in
 * the integration suite.
 */

const eur = (value: string) => toMinorUnits(value, 'EUR')

describe('deriveStatus', () => {
  it('reports UNPAID with nothing registered', () => {
    expect(deriveStatus(eur('1000.00'), 0)).toBe('UNPAID')
  })

  it('reports PARTIALLY_PAID below the amount due', () => {
    expect(deriveStatus(eur('1000.00'), eur('400.00'))).toBe('PARTIALLY_PAID')
  })

  it('reports FULLY_PAID at exactly the amount due', () => {
    expect(deriveStatus(eur('1000.00'), eur('1000.00'))).toBe('FULLY_PAID')
  })

  it('reports OVERPAID above the amount due', () => {
    expect(deriveStatus(eur('1000.00'), eur('1100.00'))).toBe('OVERPAID')
  })

  it('treats one cent short as still partially paid', () => {
    expect(deriveStatus(eur('1000.00'), eur('999.99'))).toBe('PARTIALLY_PAID')
  })

  it('treats one cent over as overpaid', () => {
    expect(deriveStatus(eur('1000.00'), eur('1000.01'))).toBe('OVERPAID')
  })

  it('reports UNPAID when nothing is owed and nothing is paid', () => {
    // A year below the nisab owes nothing; that is not "fully paid".
    expect(deriveStatus(0, 0)).toBe('UNPAID')
  })

  it('reports OVERPAID when something is paid against a zero obligation', () => {
    expect(deriveStatus(0, eur('50.00'))).toBe('OVERPAID')
  })
})

describe('computeTotals', () => {
  it('sums several payments exactly', () => {
    const totals = computeTotals(eur('1375.00'), [
      eur('500.00'),
      eur('300.00'),
      eur('575.00'),
    ])

    expect(totals.paidMinor).toBe(137_500)
    expect(totals.remainingMinor).toBe(0)
    expect(totals.overpaidMinor).toBe(0)
    expect(totals.status).toBe('FULLY_PAID')
  })

  it('reproduces the specification example step by step', () => {
    const due = eur('1375.00')

    const afterFirst = computeTotals(due, [eur('500.00')])
    expect(afterFirst.remainingMinor).toBe(87_500)
    expect(afterFirst.status).toBe('PARTIALLY_PAID')

    const afterSecond = computeTotals(due, [eur('500.00'), eur('300.00')])
    expect(afterSecond.paidMinor).toBe(80_000)
    expect(afterSecond.remainingMinor).toBe(57_500)

    const afterThird = computeTotals(due, [eur('500.00'), eur('300.00'), eur('575.00')])
    expect(afterThird.remainingMinor).toBe(0)
    expect(afterThird.status).toBe('FULLY_PAID')
  })

  it('never reports a negative remaining balance', () => {
    const totals = computeTotals(eur('1375.00'), [eur('1500.00')])

    expect(totals.remainingMinor).toBe(0)
    expect(totals.overpaidMinor).toBe(12_500)
    expect(totals.status).toBe('OVERPAID')
  })

  it('never reports a negative overpayment', () => {
    expect(computeTotals(eur('1000.00'), [eur('10.00')]).overpaidMinor).toBe(0)
  })

  it('has no floating point drift over many small payments', () => {
    const payments = Array.from({ length: 30 }, () => eur('0.10'))
    const totals = computeTotals(eur('3.00'), payments)

    // Thirty ten-cent payments are exactly three euro, not 2.9999999999999996.
    expect(totals.paidMinor).toBe(300)
    expect(totals.status).toBe('FULLY_PAID')
  })

  it('treats an empty payment list as unpaid', () => {
    const totals = computeTotals(eur('1000.00'), [])

    expect(totals.paidMinor).toBe(0)
    expect(totals.remainingMinor).toBe(100_000)
    expect(totals.status).toBe('UNPAID')
  })
})
