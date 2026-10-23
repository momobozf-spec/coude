import 'server-only'

import { Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertCanTagHousehold, assertOwner, visibleTo } from '@/server/auth/scope'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { toMinorUnits } from '@/lib/money'
import { endOfYear, startOfYear } from '@/lib/dates'
import { NotFoundError } from '@/lib/errors'
import {
  CalculationNotFinalizedError,
  DonationCalculationMismatchError,
  DonationNotFoundError,
  DonationVoidedError,
  InvalidDonationAmountError,
} from '@/server/modules/donations/errors'
import {
  DONATION_INCLUDE,
  toDonationView as toView,
  type DonationView,
} from '@/server/modules/donations/view'
import type {
  DonationCreatePayload,
  DonationFilterPayload,
  DonationUpdatePayload,
} from '@/modules/donations/schemas'

/**
 * Donation CRUD (§1, §6, §7, §8).
 *
 * Two rules shape this service:
 *
 *  1. **Nothing is hard-deleted.** A registered donation is voided, keeping the
 *     audit trail while dropping out of every total. Only the owner can do it.
 *  2. **History does not depend on mutable display data.** The charity's name is
 *     snapshotted at registration, so renaming or unlinking a charity later
 *     cannot rewrite what a past year says.
 */

// ── Reading ──────────────────────────────────────────────────────────────────

export async function listDonations(
  actor: Actor,
  filter: DonationFilterPayload = {},
): Promise<DonationView[]> {
  const rows = await prisma.donation.findMany({
    where: {
      ...visibleTo(actor),
      ...(filter.includeVoided ? {} : { status: 'ACTIVE' }),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.charityId ? { charityId: filter.charityId } : {}),
      ...(filter.currency ? { currency: filter.currency } : {}),
      ...(filter.year
        ? { donatedAt: { gte: startOfYear(filter.year), lt: endOfYear(filter.year) } }
        : {}),
    },
    include: DONATION_INCLUDE,
    orderBy: [{ donatedAt: 'desc' }, { createdAt: 'desc' }],
  })

  return rows.map((row) => toView(row, actor))
}

export async function getDonation(actor: Actor, id: string): Promise<DonationView> {
  const row = await prisma.donation.findFirst({
    where: { id, ...visibleTo(actor) },
    include: DONATION_INCLUDE,
  })

  if (!row) throw new DonationNotFoundError()
  return toView(row, actor)
}

/** The distinct years the actor has donations in, for the history filter. */
export async function donationYears(actor: Actor): Promise<number[]> {
  const rows = await prisma.donation.findMany({
    where: { ...visibleTo(actor), status: 'ACTIVE' },
    select: { donatedAt: true },
    orderBy: { donatedAt: 'desc' },
  })

  return [...new Set(rows.map((r) => r.donatedAt.getUTCFullYear()))]
}

// ── Validation shared by create and update ───────────────────────────────────

/**
 * Verify a Zakat allocation before it is stored.
 *
 * The calculation must be the actor's own, must be FINALIZED (§3), and must be
 * in the same currency — converting here with today's rate would restate a
 * historical obligation, which is exactly what the snapshot model forbids.
 */
async function assertAllocationAllowed(
  actor: Actor,
  calculationId: string,
  donationCurrency: string,
): Promise<void> {
  const calculation = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true, status: true, currency: true },
  })

  // 404 rather than 403: confirming existence would leak somebody else's id.
  assertOwner(actor, calculation)
  if (!calculation) throw new NotFoundError()

  if (calculation.status !== 'FINALIZED') throw new CalculationNotFinalizedError()

  if (calculation.currency.toUpperCase() !== donationCurrency.toUpperCase()) {
    throw new DonationCalculationMismatchError(
      `Deze berekening staat in ${calculation.currency}. Registreer de betaling in dezelfde valuta, ` +
        'of koppel hem niet aan deze berekening.',
    )
  }
}

/** Snapshot the charity name so history survives a rename (§6). */
async function resolveCharitySnapshot(charityId: string | null | undefined) {
  if (!charityId) return null
  const charity = await prisma.charity.findUnique({
    where: { id: charityId },
    select: { name: true },
  })
  return charity?.name ?? null
}

function assertPositive(amount: string, currency: string): number {
  const minor = toMinorUnits(amount, currency)
  if (minor <= 0) throw new InvalidDonationAmountError()
  return minor
}

// ── Writing ──────────────────────────────────────────────────────────────────

export async function createDonation(
  actor: Actor,
  input: DonationCreatePayload,
): Promise<DonationView> {
  assertPositive(input.amount, input.currency)

  // A retried submit must return the original row, not create a second payment.
  if (input.idempotencyKey) {
    const existing = await prisma.donation.findUnique({
      where: {
        userId_idempotencyKey: { userId: actor.userId, idempotencyKey: input.idempotencyKey },
      },
      include: DONATION_INCLUDE,
    })
    if (existing) return toView(existing, actor)
  }

  if (input.zakatCalculationId) {
    await assertAllocationAllowed(actor, input.zakatCalculationId, input.currency)
  }

  const data = {
    userId: actor.userId,
    householdId: assertCanTagHousehold(actor, input.householdId ?? null),
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    donatedAt: input.donatedAt,
    charityId: input.charityId ?? null,
    charityNameSnapshot: await resolveCharitySnapshot(input.charityId),
    recipientName: input.recipientName ?? null,
    paymentMethod: input.paymentMethod ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    zakatCalculationId: input.zakatCalculationId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  }

  let row
  try {
    row = await prisma.donation.create({ data, include: DONATION_INCLUDE })
  } catch (error) {
    // Two in-flight submits of the same key: both passed the pre-check, the
    // unique constraint stopped the second. The winner's row is the correct
    // answer for both callers — that is what idempotent means (§37).
    const isDuplicateKey =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Boolean(input.idempotencyKey)

    if (!isDuplicateKey) throw error

    const winner = await prisma.donation.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: actor.userId,
          idempotencyKey: input.idempotencyKey as string,
        },
      },
      include: DONATION_INCLUDE,
    })

    if (!winner) throw error
    return toView(winner, actor)
  }

  await recordAudit({
    userId: actor.userId,
    action: 'DONATION_CREATED',
    entityType: 'Donation',
    entityId: row.id,
    // Categorical context only — no amount, no recipient name (§28, §47).
    metadata: {
      type: row.type,
      currency: row.currency,
      allocated: Boolean(row.zakatCalculationId),
    },
  })

  trackEvent('DONATION_CREATED', actor.userId, {
    donationType: row.type,
    currency: row.currency,
    allocated: Boolean(row.zakatCalculationId),
  })

  return toView(row, actor)
}

export async function updateDonation(
  actor: Actor,
  id: string,
  input: DonationUpdatePayload,
): Promise<DonationView> {
  const existing = await prisma.donation.findUnique({ where: { id } })
  assertOwner(actor, existing)

  // A voided record is history. Correcting it means registering a new donation.
  if (existing?.status === 'VOIDED') throw new DonationVoidedError()

  assertPositive(input.amount, input.currency)

  if (input.zakatCalculationId) {
    await assertAllocationAllowed(actor, input.zakatCalculationId, input.currency)
  }

  const charityChanged = input.charityId !== existing?.charityId

  const row = await prisma.donation.update({
    where: { id },
    data: {
      householdId: assertCanTagHousehold(actor, input.householdId ?? null),
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      donatedAt: input.donatedAt,
      charityId: input.charityId ?? null,
      ...(charityChanged
        ? { charityNameSnapshot: await resolveCharitySnapshot(input.charityId) }
        : {}),
      recipientName: input.recipientName ?? null,
      paymentMethod: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      zakatCalculationId: input.zakatCalculationId ?? null,
    },
    include: DONATION_INCLUDE,
  })

  await recordAudit({
    userId: actor.userId,
    action: 'DONATION_UPDATED',
    entityType: 'Donation',
    entityId: row.id,
    metadata: {
      type: row.type,
      currency: row.currency,
      allocated: Boolean(row.zakatCalculationId),
    },
  })

  return toView(row, actor)
}

/**
 * Void a donation (§7).
 *
 * This is what `DELETE /api/donations/:id` performs. A registered payment is
 * financial history: erasing the row would make a past Zakat year unexplainable
 * and would leave the audit trail pointing at nothing.
 */
export async function voidDonation(
  actor: Actor,
  id: string,
  reason?: string,
): Promise<DonationView> {
  const existing = await prisma.donation.findUnique({ where: { id } })
  assertOwner(actor, existing)

  if (!existing) throw new DonationNotFoundError()
  if (existing.status === 'VOIDED') throw new DonationVoidedError()

  const row = await prisma.donation.update({
    where: { id },
    data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason ?? null },
    include: DONATION_INCLUDE,
  })

  await recordAudit({
    userId: actor.userId,
    action: 'DONATION_VOIDED',
    entityType: 'Donation',
    entityId: row.id,
    metadata: { type: row.type, hadAllocation: Boolean(row.zakatCalculationId) },
  })

  return toView(row, actor)
}

/**
 * Void a donation and register a corrected one in its place (§8).
 *
 * Transactional, so a correction can never leave both rows active — which would
 * double-count a payment in the Zakat summary.
 */
export async function correctDonation(
  actor: Actor,
  id: string,
  input: DonationUpdatePayload,
  reason?: string,
): Promise<DonationView> {
  const existing = await prisma.donation.findUnique({ where: { id } })
  assertOwner(actor, existing)

  if (!existing) throw new DonationNotFoundError()
  if (existing.status === 'VOIDED') throw new DonationVoidedError()

  assertPositive(input.amount, input.currency)

  if (input.zakatCalculationId) {
    await assertAllocationAllowed(actor, input.zakatCalculationId, input.currency)
  }

  const charityNameSnapshot = await resolveCharitySnapshot(input.charityId)
  const householdId = assertCanTagHousehold(actor, input.householdId ?? null)

  const replacement = await prisma.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidReason: reason ?? 'Vervangen door een correctie',
      },
    })

    return tx.donation.create({
      data: {
        userId: actor.userId,
        householdId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        donatedAt: input.donatedAt,
        charityId: input.charityId ?? null,
        charityNameSnapshot,
        recipientName: input.recipientName ?? null,
        paymentMethod: input.paymentMethod ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        zakatCalculationId: input.zakatCalculationId ?? null,
        replacesDonationId: id,
      },
      include: DONATION_INCLUDE,
    })
  })

  await recordAudit({
    userId: actor.userId,
    action: 'DONATION_CORRECTED',
    entityType: 'Donation',
    entityId: replacement.id,
    metadata: { replaces: id, type: replacement.type },
  })

  return toView(replacement, actor)
}
