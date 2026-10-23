import 'server-only'

import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { visibleTo } from '@/server/auth/scope'
import { toMinorUnits, sumMinor } from '@/lib/money'
import { endOfYear, nextAnnualOccurrence, startOfYear, toHijri } from '@/lib/dates'
import { getPaymentSummaries } from '@/server/modules/donations/payment-service'
import { listSadaqahGoalProgress } from '@/server/modules/donations/sadaqah-service'

/**
 * Everything the dashboard needs, in one place (§4).
 *
 * Phase 1 answers what the data already supports: what has been given this year,
 * when the next reckoning falls, and which inputs are still missing. The estimated
 * Zakat figure arrives with the calculation engine in phase 2 — until then the
 * dashboard says so rather than showing a zero that looks like an answer.
 */

export interface ChecklistItem {
  key: string
  label: string
  done: boolean
  href: string
}

export interface DashboardSummary {
  currency: string

  /** Donations recorded this calendar year, in minor units of `currency`. */
  donatedThisYearMinor: number
  zakatPaidThisYearMinor: number
  sadaqahThisYearMinor: number
  sadaqahThisMonthMinor: number

  /**
   * Records skipped because they are in another currency. Shown explicitly so a
   * total is never quietly wrong (conversion lands with the FX provider, phase 2).
   */
  unconvertedRecords: number

  nextZakatDate: Date | null
  nextZakatHijri: string | null
  daysUntilZakat: number | null

  /**
   * The most recent calculation, draft or finalised. Read from the stored row —
   * a finalised one is never recomputed for display (§16).
   */
  latestCalculation: {
    id: string
    status: string
    zakatDueMinor: number
    currency: string
    wizardStep: number
    /** Derived from registered donations; null while the year is still a draft. */
    paidMinor: number | null
    remainingMinor: number | null
    paymentStatus: string | null
  } | null

  /** Active Sadaqah goals with their current-period progress (§45). */
  sadaqahGoals: Array<{
    id: string
    label: string | null
    targetMinor: number
    achievedMinor: number
    currency: string
    percentage: number
  }>

  checklist: ChecklistItem[]
  completeness: number

  assetCount: number
  liabilityCount: number
  favoriteCount: number

  recentDonations: Array<{
    id: string
    type: string
    amount: string
    currency: string
    donatedAt: Date
    recipient: string
  }>
}

export async function getDashboardSummary(actor: Actor): Promise<DashboardSummary> {
  const now = new Date()
  const yearStart = startOfYear(now.getUTCFullYear())
  const yearEnd = endOfYear(now.getUTCFullYear())
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const scope = visibleTo(actor)
  const currency = actor.defaultCurrency

  const [
    profile,
    donationsThisYear,
    assetCount,
    liabilityCount,
    favoriteCount,
    recent,
    latest,
  ] = await Promise.all([
      prisma.zakatProfile.findUnique({
        where: { userId: actor.userId },
        select: { zakatDueDate: true, haulStartDate: true, defaultCurrency: true },
      }),
      prisma.donation.findMany({
        where: { ...scope, donatedAt: { gte: yearStart, lt: yearEnd } },
        select: { type: true, amount: true, currency: true, donatedAt: true },
      }),
      prisma.asset.count({ where: { userId: actor.userId, active: true } }),
      prisma.liability.count({ where: { userId: actor.userId, active: true } }),
      prisma.favoriteCharity.count({ where: { userId: actor.userId } }),
      prisma.donation.findMany({
        where: scope,
        orderBy: { donatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          donatedAt: true,
          recipientName: true,
          charity: { select: { name: true } },
        },
      }),
      prisma.zakatCalculation.findFirst({
        where: { userId: actor.userId },
        // A live draft is what the user is working on; otherwise show the most
        // recently finalised year.
        orderBy: [{ status: 'asc' }, { calculationDate: 'desc' }],
        select: {
          id: true,
          status: true,
          zakatDue: true,
          currency: true,
          wizardStep: true,
        },
      }),
    ])

  // Only same-currency rows are summed; the rest are counted and disclosed.
  const convertible = donationsThisYear.filter((d) => d.currency === currency)
  const unconvertedRecords = donationsThisYear.length - convertible.length

  const minorOf = (rows: typeof convertible) =>
    sumMinor(rows.map((d) => toMinorUnits(d.amount, currency)))

  const sadaqahTypes = new Set(['SADAQAH', 'SADAQAH_JARIYAH'])

  const donatedThisYearMinor = minorOf(convertible)
  const zakatPaidThisYearMinor = minorOf(convertible.filter((d) => d.type === 'ZAKAT'))
  const sadaqahRows = convertible.filter((d) => sadaqahTypes.has(d.type))
  const sadaqahThisYearMinor = minorOf(sadaqahRows)
  const sadaqahThisMonthMinor = minorOf(sadaqahRows.filter((d) => d.donatedAt >= monthStart))

  const nextZakatDate = profile?.zakatDueDate
    ? nextAnnualOccurrence(profile.zakatDueDate, now)
    : null

  const checklist: ChecklistItem[] = [
    {
      key: 'due-date',
      label: 'Zakat-datum ingesteld',
      done: Boolean(profile?.zakatDueDate),
      href: '/profile',
    },
    { key: 'assets', label: 'Vermogen toegevoegd', done: assetCount > 0, href: '/assets' },
    {
      key: 'liabilities',
      label: 'Schulden gecontroleerd',
      done: liabilityCount > 0,
      href: '/assets',
    },
    {
      key: 'charities',
      label: 'Goed doel gekozen',
      done: favoriteCount > 0,
      href: '/charities',
    },
  ]

  const completeness = Math.round(
    (checklist.filter((c) => c.done).length / checklist.length) * 100,
  )

  // Payment position is derived, never cached (§36). Only a finalised year can
  // have payments, so a draft skips the query entirely.
  const [payment, goals] = await Promise.all([
    latest && latest.status === 'FINALIZED'
      ? getPaymentSummaries(actor, [latest.id]).then((m) => m.get(latest.id) ?? null)
      : Promise.resolve(null),
    listSadaqahGoalProgress(actor, now),
  ])

  return {
    currency,
    donatedThisYearMinor,
    zakatPaidThisYearMinor,
    sadaqahThisYearMinor,
    sadaqahThisMonthMinor,
    unconvertedRecords,
    nextZakatDate,
    nextZakatHijri: nextZakatDate ? toHijri(nextZakatDate).formatted : null,
    daysUntilZakat: nextZakatDate
      ? Math.max(0, Math.round((nextZakatDate.getTime() - now.getTime()) / 86_400_000))
      : null,

    latestCalculation: latest
      ? {
          id: latest.id,
          status: latest.status,
          zakatDueMinor: toMinorUnits(latest.zakatDue, latest.currency),
          currency: latest.currency,
          wizardStep: latest.wizardStep,
          paidMinor: payment?.paidMinor ?? null,
          remainingMinor: payment?.remainingMinor ?? null,
          paymentStatus: payment?.status ?? null,
        }
      : null,

    sadaqahGoals: goals.map((goal) => ({
      id: goal.id,
      label: goal.label,
      targetMinor: goal.targetMinor,
      achievedMinor: goal.achievedMinor,
      currency: goal.currency,
      percentage: goal.percentage,
    })),
    checklist,
    completeness,
    assetCount,
    liabilityCount,
    favoriteCount,
    recentDonations: recent.map((d) => ({
      id: d.id,
      type: d.type,
      amount: d.amount.toString(),
      currency: d.currency,
      donatedAt: d.donatedAt,
      recipient: d.charity?.name ?? d.recipientName ?? 'Onbekende ontvanger',
    })),
  }
}
