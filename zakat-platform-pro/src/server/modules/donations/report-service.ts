import 'server-only'

import type { DonationType } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { visibleTo } from '@/server/auth/scope'
import { sumMinor, toMinorUnits } from '@/lib/money'
import { endOfYear, startOfYear } from '@/lib/dates'

/**
 * Donation history aggregates (§19, §21, §22).
 *
 * ── Currency policy ───────────────────────────────────────────────────────────
 * A donation is never re-valued. Converting a January payment at today's rate
 * would present a number the user never gave as though it were historical fact —
 * the same mistake the calculation snapshot exists to prevent.
 *
 * Donations do not carry an FX snapshot (nothing converted them at the time), so
 * totals are reported **per currency**. A mixed year shows two totals rather
 * than one wrong one. If a converted view is wanted later, it needs a rate
 * captured at donation time, not one fetched at read time.
 */

export interface CurrencyTotal {
  currency: string
  totalMinor: number
  count: number
}

export interface TypeBreakdown {
  type: DonationType
  totals: CurrencyTotal[]
}

export interface RecipientBreakdown {
  charityId: string | null
  label: string
  totals: CurrencyTotal[]
}

export interface MonthBreakdown {
  /** 1–12. */
  month: number
  totals: CurrencyTotal[]
}

export interface DonationYearSummary {
  year: number
  donationCount: number

  /** Overall totals, one entry per currency used that year. */
  totals: CurrencyTotal[]
  /** True when more than one currency was used — the UI says so rather than adding up. */
  mixedCurrency: boolean

  byType: TypeBreakdown[]
  byMonth: MonthBreakdown[]
  byRecipient: RecipientBreakdown[]
}

interface Bucketable {
  currency: string
  amountMinor: number
}

function bucketByCurrency(rows: readonly Bucketable[]): CurrencyTotal[] {
  const buckets = new Map<string, number[]>()

  for (const row of rows) {
    const list = buckets.get(row.currency) ?? []
    list.push(row.amountMinor)
    buckets.set(row.currency, list)
  }

  return [...buckets.entries()]
    .map(([currency, amounts]) => ({
      currency,
      totalMinor: sumMinor(amounts),
      count: amounts.length,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor)
}

/**
 * Everything the year overview needs, in one query.
 *
 * Aggregation happens in memory on purpose: a personal year holds tens of rows,
 * and grouping here keeps the per-currency rule in one readable place instead of
 * spread across several `groupBy` calls that would each need the same guard.
 */
export async function getDonationYearSummary(
  actor: Actor,
  year: number,
): Promise<DonationYearSummary> {
  const rows = await prisma.donation.findMany({
    where: {
      ...visibleTo(actor),
      status: 'ACTIVE',
      donatedAt: { gte: startOfYear(year), lt: endOfYear(year) },
    },
    select: {
      type: true,
      amount: true,
      currency: true,
      donatedAt: true,
      charityId: true,
      charityNameSnapshot: true,
      recipientName: true,
      charity: { select: { name: true } },
    },
  })

  const enriched = rows.map((row) => ({
    type: row.type,
    currency: row.currency,
    amountMinor: toMinorUnits(row.amount, row.currency),
    month: row.donatedAt.getUTCMonth() + 1,
    charityId: row.charityId,
    label:
      row.charity?.name ??
      row.charityNameSnapshot ??
      row.recipientName ??
      'Overige ontvangers',
  }))

  const totals = bucketByCurrency(enriched)

  const types = [...new Set(enriched.map((r) => r.type))]
  const byType: TypeBreakdown[] = types.map((type) => ({
    type,
    totals: bucketByCurrency(enriched.filter((r) => r.type === type)),
  }))

  const months = [...new Set(enriched.map((r) => r.month))].sort((a, b) => a - b)
  const byMonth: MonthBreakdown[] = months.map((month) => ({
    month,
    totals: bucketByCurrency(enriched.filter((r) => r.month === month)),
  }))

  // Grouped by label rather than id so a free-text recipient and a directory
  // charity both appear, and a since-renamed charity keeps its historical name.
  const labels = [...new Set(enriched.map((r) => r.label))]
  const byRecipient: RecipientBreakdown[] = labels
    .map((label) => {
      const matching = enriched.filter((r) => r.label === label)
      return {
        charityId: matching[0]?.charityId ?? null,
        label,
        totals: bucketByCurrency(matching),
      }
    })
    .sort((a, b) => (b.totals[0]?.totalMinor ?? 0) - (a.totals[0]?.totalMinor ?? 0))

  return {
    year,
    donationCount: enriched.length,
    totals,
    mixedCurrency: totals.length > 1,
    byType,
    byMonth,
    byRecipient,
  }
}

/**
 * Sadaqah totals for the dashboard (§9).
 *
 * Zakat is excluded by construction — only the voluntary types are counted, in
 * the actor's own currency.
 */
export async function getSadaqahTotals(
  actor: Actor,
  now: Date = new Date(),
): Promise<{ currency: string; monthMinor: number; yearMinor: number; skipped: number }> {
  const currency = actor.defaultCurrency
  const year = now.getUTCFullYear()
  const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1))

  const rows = await prisma.donation.findMany({
    where: {
      ...visibleTo(actor),
      status: 'ACTIVE',
      type: { in: ['SADAQAH', 'SADAQAH_JARIYAH'] },
      donatedAt: { gte: startOfYear(year), lt: endOfYear(year) },
    },
    select: { amount: true, currency: true, donatedAt: true },
  })

  const sameCurrency = rows.filter((r) => r.currency === currency)

  return {
    currency,
    monthMinor: sumMinor(
      sameCurrency
        .filter((r) => r.donatedAt >= monthStart)
        .map((r) => toMinorUnits(r.amount, currency)),
    ),
    yearMinor: sumMinor(sameCurrency.map((r) => toMinorUnits(r.amount, currency))),
    // Disclosed rather than silently converted.
    skipped: rows.length - sameCurrency.length,
  }
}
