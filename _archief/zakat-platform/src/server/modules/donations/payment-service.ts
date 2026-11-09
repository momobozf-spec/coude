import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertOwner, visibleTo } from '@/server/auth/scope'
import { trackEvent } from '@/server/services/analytics'
import { sumMinor, toMinorUnits } from '@/lib/money'
import { NotFoundError } from '@/lib/errors'
import { CalculationNotFinalizedError } from '@/server/modules/donations/errors'
import { createDonation } from '@/server/modules/donations/service'
import {
  DONATION_INCLUDE,
  toDonationView,
  type DonationView,
} from '@/server/modules/donations/view'
import type { ZakatPaymentPayload } from '@/modules/donations/schemas'

/**
 * Zakat payment tracking (§2, §4, §5, §36).
 *
 * The paid total is **always derived**, never stored:
 *
 *     paid = Σ active ZAKAT donations linked to this calculation
 *
 * There is deliberately no `paidAmount` column. A cached counter drifts the
 * moment two payments are registered at once, or a donation is voided, or a
 * correction replaces one — and a drifted Zakat balance is the kind of error a
 * user would only notice a year later. Summing persisted rows costs one indexed
 * query and cannot be wrong.
 */

export type ZakatPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERPAID'

export interface ZakatPaymentSummary {
  calculationId: string
  currency: string

  zakatDueMinor: number
  paidMinor: number
  /** Never negative — what is still owed. */
  remainingMinor: number
  /** Never negative — what was paid beyond the obligation. */
  overpaidMinor: number

  status: ZakatPaymentStatus
  paymentCount: number
  payments: DonationView[]
}

/**
 * Pure status derivation, so the rule is testable without a database and reads
 * as a single expression rather than being scattered across the query.
 */
export function deriveStatus(zakatDueMinor: number, paidMinor: number): ZakatPaymentStatus {
  if (paidMinor <= 0) return 'UNPAID'
  if (paidMinor < zakatDueMinor) return 'PARTIALLY_PAID'
  if (paidMinor === zakatDueMinor) return 'FULLY_PAID'
  return 'OVERPAID'
}

export interface PaymentTotals {
  paidMinor: number
  remainingMinor: number
  overpaidMinor: number
  status: ZakatPaymentStatus
}

/** Pure: given a due amount and the payments, what is the position? */
export function computeTotals(
  zakatDueMinor: number,
  paymentsMinor: readonly number[],
): PaymentTotals {
  const paidMinor = sumMinor(paymentsMinor)

  return {
    paidMinor,
    remainingMinor: Math.max(0, zakatDueMinor - paidMinor),
    overpaidMinor: Math.max(0, paidMinor - zakatDueMinor),
    status: deriveStatus(zakatDueMinor, paidMinor),
  }
}

/**
 * The payment position for one calculation.
 *
 * Voided donations are excluded by the `status: 'ACTIVE'` filter, and only
 * ZAKAT-typed rows count — a Sadaqah payment never settles an obligation.
 */
export async function getZakatPaymentSummary(
  actor: Actor,
  calculationId: string,
): Promise<ZakatPaymentSummary> {
  const calculation = await prisma.zakatCalculation.findFirst({
    where: { id: calculationId, ...visibleTo(actor) },
    select: { id: true, currency: true, zakatDue: true, status: true },
  })

  if (!calculation) throw new NotFoundError()

  const currency = calculation.currency
  const zakatDueMinor = toMinorUnits(calculation.zakatDue, currency)

  const rows = await prisma.donation.findMany({
    where: {
      zakatCalculationId: calculationId,
      status: 'ACTIVE',
      type: 'ZAKAT',
      ...visibleTo(actor),
    },
    include: DONATION_INCLUDE,
    orderBy: [{ donatedAt: 'asc' }, { createdAt: 'asc' }],
  })

  // A payment is only allowed to be linked in the calculation's own currency
  // (enforced on write), so summing is exact and needs no conversion.
  const totals = computeTotals(
    zakatDueMinor,
    rows.map((row) => toMinorUnits(row.amount, currency)),
  )

  return {
    calculationId: calculation.id,
    currency,
    zakatDueMinor,
    ...totals,
    paymentCount: rows.length,
    payments: rows.map((row) => toDonationView(row, actor)),
  }
}

/**
 * Register a payment against a finalised calculation (§24).
 *
 * Type and calculation link are set here rather than taken from the client, so
 * the one path that settles an obligation cannot be pointed somewhere else by a
 * crafted request.
 */
export async function registerZakatPayment(
  actor: Actor,
  calculationId: string,
  input: ZakatPaymentPayload,
): Promise<{ donation: DonationView; summary: ZakatPaymentSummary }> {
  const calculation = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true, status: true, currency: true },
  })

  assertOwner(actor, calculation)
  if (!calculation) throw new NotFoundError()

  // Registering against a draft would mean a payment settling a figure that can
  // still change underneath it (§3).
  if (calculation.status !== 'FINALIZED') throw new CalculationNotFinalizedError()

  const donation = await createDonation(actor, {
    type: 'ZAKAT',
    amount: input.amount,
    currency: calculation.currency,
    donatedAt: input.donatedAt,
    charityId: input.charityId ?? null,
    recipientName: input.recipientName ?? null,
    paymentMethod: input.paymentMethod ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    zakatCalculationId: calculationId,
    idempotencyKey: input.idempotencyKey,
  })

  const summary = await getZakatPaymentSummary(actor, calculationId)

  trackEvent('ZAKAT_PAYMENT_REGISTERED', actor.userId, {
    currency: summary.currency,
    paymentStatus: summary.status,
  })

  if (summary.status === 'FULLY_PAID' || summary.status === 'OVERPAID') {
    trackEvent('ZAKAT_PAYMENT_COMPLETED', actor.userId, {
      currency: summary.currency,
      paymentStatus: summary.status,
    })
  }

  return { donation, summary }
}

/**
 * Payment position for several calculations at once — used by the Zakat history
 * list, which would otherwise fire one summary query per year.
 */
export async function getPaymentSummaries(
  actor: Actor,
  calculationIds: readonly string[],
): Promise<Map<string, PaymentTotals & { zakatDueMinor: number; currency: string }>> {
  if (calculationIds.length === 0) return new Map()

  const [calculations, donations] = await Promise.all([
    prisma.zakatCalculation.findMany({
      where: { id: { in: [...calculationIds] }, ...visibleTo(actor) },
      select: { id: true, currency: true, zakatDue: true },
    }),
    prisma.donation.findMany({
      where: {
        zakatCalculationId: { in: [...calculationIds] },
        status: 'ACTIVE',
        type: 'ZAKAT',
        ...visibleTo(actor),
      },
      select: { zakatCalculationId: true, amount: true, currency: true },
    }),
  ])

  const byCalculation = new Map<string, number[]>()
  for (const donation of donations) {
    if (!donation.zakatCalculationId) continue
    const bucket = byCalculation.get(donation.zakatCalculationId) ?? []
    bucket.push(toMinorUnits(donation.amount, donation.currency))
    byCalculation.set(donation.zakatCalculationId, bucket)
  }

  return new Map(
    calculations.map((calculation) => {
      const zakatDueMinor = toMinorUnits(calculation.zakatDue, calculation.currency)
      return [
        calculation.id,
        {
          zakatDueMinor,
          currency: calculation.currency,
          ...computeTotals(zakatDueMinor, byCalculation.get(calculation.id) ?? []),
        },
      ]
    }),
  )
}
