import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { visibleTo } from '@/server/auth/scope'
import { sumMinor, toMinorUnits } from '@/lib/money'
import { endOfYear, startOfYear } from '@/lib/dates'
import { computeTotals, type ZakatPaymentStatus } from '@/server/modules/donations/payment-service'

/**
 * The annual report domain model (§27–§30).
 *
 * Built entirely from data the user registered themselves. Two rules carry over
 * from earlier phases and are load-bearing here:
 *
 *  • **Currencies stay separate.** Donations carry no historical FX snapshot, so
 *    a year with euros and dirhams reports two totals, never one converted at
 *    today's rate (§28).
 *  • **Voided donations are excluded, everywhere.** The `status: 'ACTIVE'` filter
 *    is applied at the query, so a voided payment cannot survive in one section
 *    while disappearing from another.
 */

/** Bump when the shape of a stored snapshot changes (§36). */
export const ANNUAL_REPORT_VERSION = 'annual-report@1'

export const ANNUAL_REPORT_DISCLAIMER =
  'Dit is een persoonlijk overzicht op basis van de gegevens die je zelf in Barakah hebt ' +
  'geregistreerd. Het is geen fiscaal attest, geen officieel donatiebewijs en geen ' +
  'bevestiging dat je Zakat religieus correct is voldaan.'

export interface CurrencyAmount {
  currency: string
  amountMinor: number
  count: number
}

export interface ZakatYearEntry {
  calculationId: string
  calculationDate: Date
  currency: string
  zakatDueMinor: number
  paidMinor: number
  remainingMinor: number
  overpaidMinor: number
  status: ZakatPaymentStatus
  rulesVersion: string
}

export interface RecipientEntry {
  label: string
  charityId: string | null
  totals: CurrencyAmount[]
  /** How many of these donations have a receipt attached (§30). */
  withReceipt: number
}

export interface MonthEntry {
  month: number
  totals: CurrencyAmount[]
}

export interface AnnualReportData {
  version: string
  year: number
  periodType: 'GREGORIAN_YEAR'
  generatedAt: string

  /** Denormalised so a stored snapshot renders without touching the user table. */
  userName: string | null

  donationCount: number
  totals: CurrencyAmount[]
  mixedCurrency: boolean

  byType: Array<{ type: string; totals: CurrencyAmount[] }>
  byMonth: MonthEntry[]
  byRecipient: RecipientEntry[]

  zakatYears: ZakatYearEntry[]

  receiptsAttached: number
  disclaimer: string
}

function bucket(rows: ReadonlyArray<{ currency: string; amountMinor: number }>): CurrencyAmount[] {
  const map = new Map<string, number[]>()

  for (const row of rows) {
    map.set(row.currency, [...(map.get(row.currency) ?? []), row.amountMinor])
  }

  return [...map.entries()]
    .map(([currency, amounts]) => ({
      currency,
      amountMinor: sumMinor(amounts),
      count: amounts.length,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}

/**
 * Build the report live from current data.
 *
 * This is what the preview shows. Generating a downloadable report freezes the
 * output of this function into an `AnnualReport` row (§36).
 */
export async function buildAnnualReport(
  actor: Actor,
  year: number,
  now: Date = new Date(),
): Promise<AnnualReportData> {
  const scope = visibleTo(actor)
  const from = startOfYear(year)
  const to = endOfYear(year)

  const [donations, calculations, payments] = await Promise.all([
    prisma.donation.findMany({
      where: { ...scope, status: 'ACTIVE', donatedAt: { gte: from, lt: to } },
      select: {
        type: true,
        amount: true,
        currency: true,
        donatedAt: true,
        charityId: true,
        charityNameSnapshot: true,
        recipientName: true,
        receiptDocumentId: true,
        charity: { select: { name: true } },
      },
    }),
    prisma.zakatCalculation.findMany({
      where: {
        ...scope,
        status: 'FINALIZED',
        calculationDate: { gte: from, lt: to },
      },
      select: {
        id: true,
        calculationDate: true,
        currency: true,
        zakatDue: true,
        rulesVersion: true,
      },
      orderBy: { calculationDate: 'asc' },
    }),
    prisma.donation.findMany({
      where: {
        ...scope,
        status: 'ACTIVE',
        type: 'ZAKAT',
        zakatCalculationId: { not: null },
      },
      select: { zakatCalculationId: true, amount: true, currency: true },
    }),
  ])

  const enriched = donations.map((row) => ({
    type: row.type,
    currency: row.currency,
    amountMinor: toMinorUnits(row.amount, row.currency),
    month: row.donatedAt.getUTCMonth() + 1,
    charityId: row.charityId,
    hasReceipt: Boolean(row.receiptDocumentId),
    // Historical name first: a renamed charity must not rewrite a past year (§47).
    label:
      row.charityNameSnapshot ??
      row.charity?.name ??
      row.recipientName ??
      'Overige ontvangers',
  }))

  const totals = bucket(enriched)

  const types = [...new Set(enriched.map((r) => r.type))].sort()
  const byType = types.map((type) => ({
    type,
    totals: bucket(enriched.filter((r) => r.type === type)),
  }))

  const months = [...new Set(enriched.map((r) => r.month))].sort((a, b) => a - b)
  const byMonth = months.map((month) => ({
    month,
    totals: bucket(enriched.filter((r) => r.month === month)),
  }))

  const labels = [...new Set(enriched.map((r) => r.label))]
  const byRecipient = labels
    .map((label) => {
      const matching = enriched.filter((r) => r.label === label)
      return {
        label,
        charityId: matching[0]?.charityId ?? null,
        totals: bucket(matching),
        withReceipt: matching.filter((r) => r.hasReceipt).length,
      }
    })
    .sort((a, b) => (b.totals[0]?.amountMinor ?? 0) - (a.totals[0]?.amountMinor ?? 0))

  // Payments are grouped per calculation, matching the phase-3 rule that `paid`
  // is always the sum of active linked ZAKAT donations — never a stored counter.
  const paymentsByCalculation = new Map<string, number[]>()
  for (const payment of payments) {
    if (!payment.zakatCalculationId) continue
    paymentsByCalculation.set(payment.zakatCalculationId, [
      ...(paymentsByCalculation.get(payment.zakatCalculationId) ?? []),
      toMinorUnits(payment.amount, payment.currency),
    ])
  }

  const zakatYears: ZakatYearEntry[] = calculations.map((calculation) => {
    const dueMinor = toMinorUnits(calculation.zakatDue, calculation.currency)
    const computed = computeTotals(dueMinor, paymentsByCalculation.get(calculation.id) ?? [])

    return {
      calculationId: calculation.id,
      calculationDate: calculation.calculationDate,
      currency: calculation.currency,
      zakatDueMinor: dueMinor,
      paidMinor: computed.paidMinor,
      remainingMinor: computed.remainingMinor,
      overpaidMinor: computed.overpaidMinor,
      status: computed.status,
      rulesVersion: calculation.rulesVersion,
    }
  })

  return {
    version: ANNUAL_REPORT_VERSION,
    year,
    periodType: 'GREGORIAN_YEAR',
    generatedAt: now.toISOString(),
    userName: actor.name,

    donationCount: enriched.length,
    totals,
    mixedCurrency: totals.length > 1,

    byType,
    byMonth,
    byRecipient,
    zakatYears,

    receiptsAttached: enriched.filter((r) => r.hasReceipt).length,
    disclaimer: ANNUAL_REPORT_DISCLAIMER,
  }
}

/** Years the user has any activity in, for the year picker. */
export async function reportYears(actor: Actor): Promise<number[]> {
  const scope = visibleTo(actor)

  const [donations, calculations] = await Promise.all([
    prisma.donation.findMany({
      where: { ...scope, status: 'ACTIVE' },
      select: { donatedAt: true },
    }),
    prisma.zakatCalculation.findMany({
      where: { ...scope, status: 'FINALIZED' },
      select: { calculationDate: true },
    }),
  ])

  const years = new Set<number>([
    ...donations.map((d) => d.donatedAt.getUTCFullYear()),
    ...calculations.map((c) => c.calculationDate.getUTCFullYear()),
  ])

  return [...years].sort((a, b) => b - a)
}
