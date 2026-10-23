import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createRuleSet, createTestUser, prisma, resetDatabase } from './setup'
import { createAsset } from '@/server/modules/assets/service'
import {
  finalizeCalculation,
  getOrCreateDraft,
} from '@/server/modules/zakat/calculation-service'
import {
  correctDonation,
  createDonation,
  getDonation,
  listDonations,
  updateDonation,
  voidDonation,
} from '@/server/modules/donations/service'
import {
  getPaymentSummaries,
  getZakatPaymentSummary,
  registerZakatPayment,
} from '@/server/modules/donations/payment-service'
import { getDonationYearSummary } from '@/server/modules/donations/report-service'
import {
  CalculationNotFinalizedError,
  DonationCalculationMismatchError,
  DonationNotFoundError,
  DonationVoidedError,
  InvalidDonationAmountError,
} from '@/server/modules/donations/errors'
import { NotFoundError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'

/**
 * Donations and Zakat payment tracking against a real database (§43).
 *
 * The behaviour that matters here cannot be tested without persistence: that the
 * paid total is a live sum rather than a stored counter, that voiding removes an
 * amount without removing the record, and that a payment cannot be pointed at
 * somebody else's year.
 */

const suite = hasDatabase ? describe : describe.skip

async function finalizedYear(email: string): Promise<{ actor: Actor; calculationId: string }> {
  await createRuleSet()
  const actor = await createTestUser({ email })

  await createAsset(actor, {
    type: 'SAVINGS',
    name: 'Spaargeld',
    value: '55000.00',
    currency: 'EUR',
  })

  const draft = await getOrCreateDraft(actor)
  const finalized = await finalizeCalculation(actor, draft.id)

  // €55,000 × 2.5% = €1,375.00
  expect(finalized.zakatDueMinor).toBe(137_500)

  return { actor, calculationId: finalized.id }
}

suite('donation CRUD', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates and reads back a donation', async () => {
    const actor = await createTestUser({ email: 'd1@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '85.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
      recipientName: 'Lokale moskee',
    })

    expect(donation.amountMinor).toBe(8_500)
    expect(donation.status).toBe('ACTIVE')
    expect(donation.recipientLabel).toBe('Lokale moskee')

    const fetched = await getDonation(actor, donation.id)
    expect(fetched.id).toBe(donation.id)
  })

  it('rejects a zero or negative amount at the service boundary', async () => {
    const actor = await createTestUser({ email: 'd2@test.local' })

    await expect(
      createDonation(actor, {
        type: 'SADAQAH',
        amount: '0.00',
        currency: 'EUR',
        donatedAt: new Date(),
      }),
    ).rejects.toThrow(InvalidDonationAmountError)
  })

  it('snapshots the charity name so a rename cannot rewrite history', async () => {
    const actor = await createTestUser({ email: 'd3@test.local' })
    const charity = await prisma.charity.create({
      data: { slug: 'c1', name: 'Oude Naam', country: 'BE', website: 'https://example.org' },
    })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date(),
      charityId: charity.id,
    })

    const row = await prisma.donation.findUniqueOrThrow({ where: { id: donation.id } })
    expect(row.charityNameSnapshot).toBe('Oude Naam')

    // Unlinking the charity leaves the historical name readable.
    await prisma.charity.delete({ where: { id: charity.id } })
    const afterDelete = await getDonation(actor, donation.id)
    expect(afterDelete.recipientLabel).toBe('Oude Naam')
  })

  it('updates a donation', async () => {
    const actor = await createTestUser({ email: 'd4@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date('2026-01-01T00:00:00Z'),
    })

    const updated = await updateDonation(actor, donation.id, {
      type: 'SADAQAH',
      amount: '25.00',
      currency: 'EUR',
      donatedAt: new Date('2026-01-02T00:00:00Z'),
    })

    expect(updated.amountMinor).toBe(2_500)
  })

  it('voids rather than deletes', async () => {
    const actor = await createTestUser({ email: 'd5@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date(),
    })

    const voided = await voidDonation(actor, donation.id, 'Dubbel ingevoerd')

    expect(voided.status).toBe('VOIDED')
    expect(voided.voidReason).toBe('Dubbel ingevoerd')

    // The row survives — history stays auditable.
    expect(await prisma.donation.count({ where: { id: donation.id } })).toBe(1)

    // …but it drops out of the default listing.
    expect(await listDonations(actor)).toHaveLength(0)
    expect(await listDonations(actor, { includeVoided: true })).toHaveLength(1)
  })

  it('refuses to edit a voided donation', async () => {
    const actor = await createTestUser({ email: 'd6@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date(),
    })
    await voidDonation(actor, donation.id)

    await expect(
      updateDonation(actor, donation.id, {
        type: 'SADAQAH',
        amount: '30.00',
        currency: 'EUR',
        donatedAt: new Date(),
      }),
    ).rejects.toThrow(DonationVoidedError)
  })

  it('corrects by voiding and replacing, atomically', async () => {
    const actor = await createTestUser({ email: 'd7@test.local' })

    const original = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-01T00:00:00Z'),
    })

    const corrected = await correctDonation(actor, original.id, {
      type: 'SADAQAH',
      amount: '200.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-01T00:00:00Z'),
    })

    expect(corrected.replacesDonationId).toBe(original.id)
    expect(corrected.amountMinor).toBe(20_000)

    // Exactly one of the pair is active — never both, which would double-count.
    const active = await listDonations(actor)
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe(corrected.id)
  })

  it('never returns another user’s donation', async () => {
    const a = await createTestUser({ email: 'x1@test.local' })
    const b = await createTestUser({ email: 'x2@test.local' })

    const donation = await createDonation(b, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date(),
    })

    await expect(getDonation(a, donation.id)).rejects.toThrow(DonationNotFoundError)
    await expect(voidDonation(a, donation.id)).rejects.toThrow(NotFoundError)
    expect(await listDonations(a)).toHaveLength(0)
  })
})

suite('idempotency', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns the original row for a repeated key rather than creating a second', async () => {
    const actor = await createTestUser({ email: 'i1@test.local' })

    const payload = {
      type: 'SADAQAH' as const,
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-08T00:00:00Z'),
      idempotencyKey: 'form-session-abc12345',
    }

    const first = await createDonation(actor, payload)
    const second = await createDonation(actor, payload)

    expect(second.id).toBe(first.id)
    expect(await prisma.donation.count({ where: { userId: actor.userId } })).toBe(1)
  })

  it('survives concurrent submits of the same key', async () => {
    const actor = await createTestUser({ email: 'i2@test.local' })

    const payload = {
      type: 'SADAQAH' as const,
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-08T00:00:00Z'),
      idempotencyKey: 'double-tap-key-9876',
    }

    // Two in-flight requests: at most one row may exist afterwards. The unique
    // constraint is the backstop when both pass the pre-check.
    const results = await Promise.allSettled([
      createDonation(actor, payload),
      createDonation(actor, payload),
    ])

    expect(results.some((r) => r.status === 'fulfilled')).toBe(true)
    expect(await prisma.donation.count({ where: { userId: actor.userId } })).toBe(1)
  })

  it('keeps keys scoped per user', async () => {
    const a = await createTestUser({ email: 'i3@test.local' })
    const b = await createTestUser({ email: 'i4@test.local' })

    const payload = {
      type: 'SADAQAH' as const,
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date(),
      idempotencyKey: 'shared-key-value-1234',
    }

    await createDonation(a, payload)
    await createDonation(b, payload)

    // One person's retry token must not block another person's donation.
    expect(await prisma.donation.count()).toBe(2)
  })
})

suite('zakat payment tracking', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('walks the full payment flow from unpaid to fully paid', async () => {
    const { actor, calculationId } = await finalizedYear('p1@test.local')

    const initial = await getZakatPaymentSummary(actor, calculationId)
    expect(initial.status).toBe('UNPAID')
    expect(initial.remainingMinor).toBe(137_500)

    await registerZakatPayment(actor, calculationId, {
      amount: '500.00',
      donatedAt: new Date('2026-03-20T00:00:00Z'),
    })

    const afterFirst = await getZakatPaymentSummary(actor, calculationId)
    expect(afterFirst.status).toBe('PARTIALLY_PAID')
    expect(afterFirst.paidMinor).toBe(50_000)
    expect(afterFirst.remainingMinor).toBe(87_500)

    await registerZakatPayment(actor, calculationId, {
      amount: '300.00',
      donatedAt: new Date('2026-03-22T00:00:00Z'),
    })

    const { summary } = await registerZakatPayment(actor, calculationId, {
      amount: '575.00',
      donatedAt: new Date('2026-04-02T00:00:00Z'),
    })

    expect(summary.paidMinor).toBe(137_500)
    expect(summary.remainingMinor).toBe(0)
    expect(summary.status).toBe('FULLY_PAID')
    expect(summary.paymentCount).toBe(3)
  })

  it('reports OVERPAID without changing the donation type', async () => {
    const { actor, calculationId } = await finalizedYear('p2@test.local')

    await registerZakatPayment(actor, calculationId, {
      amount: '1500.00',
      donatedAt: new Date('2026-03-20T00:00:00Z'),
    })

    const summary = await getZakatPaymentSummary(actor, calculationId)

    expect(summary.status).toBe('OVERPAID')
    expect(summary.overpaidMinor).toBe(12_500)
    expect(summary.remainingMinor).toBe(0)
    // The excess is flagged, never silently reclassified as Sadaqah (§5).
    expect(summary.payments[0]?.type).toBe('ZAKAT')
  })

  it('excludes a voided payment from the total', async () => {
    const { actor, calculationId } = await finalizedYear('p3@test.local')

    const { donation } = await registerZakatPayment(actor, calculationId, {
      amount: '500.00',
      donatedAt: new Date('2026-03-20T00:00:00Z'),
    })
    await registerZakatPayment(actor, calculationId, {
      amount: '300.00',
      donatedAt: new Date('2026-03-21T00:00:00Z'),
    })

    expect((await getZakatPaymentSummary(actor, calculationId)).paidMinor).toBe(80_000)

    await voidDonation(actor, donation.id, 'Dubbel geregistreerd')

    const after = await getZakatPaymentSummary(actor, calculationId)

    // The sum is derived, so voiding is immediately reflected — no counter to drift.
    expect(after.paidMinor).toBe(30_000)
    expect(after.status).toBe('PARTIALLY_PAID')
    expect(after.paymentCount).toBe(1)
  })

  it('refuses to attach a payment to a draft calculation', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'p4@test.local' })
    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '55000.00',
      currency: 'EUR',
    })

    const draft = await getOrCreateDraft(actor)

    await expect(
      registerZakatPayment(actor, draft.id, { amount: '100.00', donatedAt: new Date() }),
    ).rejects.toThrow(CalculationNotFinalizedError)
  })

  it('refuses a payment in a different currency than the calculation', async () => {
    const { actor, calculationId } = await finalizedYear('p5@test.local')

    await expect(
      createDonation(actor, {
        type: 'ZAKAT',
        amount: '500.00',
        currency: 'USD',
        donatedAt: new Date(),
        zakatCalculationId: calculationId,
      }),
    ).rejects.toThrow(DonationCalculationMismatchError)
  })

  it('does not count a Sadaqah donation towards a Zakat obligation', async () => {
    const { actor, calculationId } = await finalizedYear('p6@test.local')

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '900.00',
      currency: 'EUR',
      donatedAt: new Date(),
    })

    expect((await getZakatPaymentSummary(actor, calculationId)).paidMinor).toBe(0)
  })

  it('does not count a payment made against another calculation', async () => {
    const { actor, calculationId } = await finalizedYear('p7@test.local')

    await registerZakatPayment(actor, calculationId, {
      amount: '500.00',
      donatedAt: new Date(),
    })

    // A second finalised year for the same user.
    await prisma.zakatCalculation.updateMany({
      where: { userId: actor.userId },
      data: { calculationDate: new Date('2025-03-15T00:00:00Z') },
    })
    await createAsset(actor, {
      type: 'CASH',
      name: 'Contant',
      value: '20000.00',
      currency: 'EUR',
    })
    const secondDraft = await getOrCreateDraft(actor)
    const second = await finalizeCalculation(actor, secondDraft.id)

    expect((await getZakatPaymentSummary(actor, second.id)).paidMinor).toBe(0)
    expect((await getZakatPaymentSummary(actor, calculationId)).paidMinor).toBe(50_000)
  })

  it('refuses to register a payment on someone else’s calculation', async () => {
    const { calculationId } = await finalizedYear('p8@test.local')
    const stranger = await createTestUser({ email: 'p9@test.local' })

    await expect(
      registerZakatPayment(stranger, calculationId, {
        amount: '100.00',
        donatedAt: new Date(),
      }),
    ).rejects.toThrow(NotFoundError)

    await expect(getZakatPaymentSummary(stranger, calculationId)).rejects.toThrow(NotFoundError)
  })

  it('batches summaries for several years in one pass', async () => {
    const { actor, calculationId } = await finalizedYear('p10@test.local')
    await registerZakatPayment(actor, calculationId, {
      amount: '400.00',
      donatedAt: new Date(),
    })

    const summaries = await getPaymentSummaries(actor, [calculationId])
    const summary = summaries.get(calculationId)

    expect(summary?.paidMinor).toBe(40_000)
    expect(summary?.status).toBe('PARTIALLY_PAID')
  })
})

suite('year summary', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('breaks a year down by type and month', async () => {
    const actor = await createTestUser({ email: 'y1@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })
    await createDonation(actor, {
      type: 'SADAQAH_JARIYAH',
      amount: '250.00',
      currency: 'EUR',
      donatedAt: new Date('2026-07-01T00:00:00Z'),
    })

    const summary = await getDonationYearSummary(actor, 2026)

    expect(summary.donationCount).toBe(2)
    expect(summary.totals).toEqual([{ currency: 'EUR', totalMinor: 35_000, count: 2 }])
    expect(summary.mixedCurrency).toBe(false)
    expect(summary.byMonth.map((m) => m.month)).toEqual([3, 7])
  })

  it('keeps currencies apart instead of adding them up', async () => {
    const actor = await createTestUser({ email: 'y2@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })
    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'USD',
      donatedAt: new Date('2026-04-10T00:00:00Z'),
    })

    const summary = await getDonationYearSummary(actor, 2026)

    // Converting a March payment at today's rate would restate what was given.
    expect(summary.mixedCurrency).toBe(true)
    expect(summary.totals).toHaveLength(2)
    expect(summary.totals.map((t) => t.currency).sort()).toEqual(['EUR', 'USD'])
  })

  it('excludes voided donations', async () => {
    const actor = await createTestUser({ email: 'y3@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })
    await voidDonation(actor, donation.id)

    const summary = await getDonationYearSummary(actor, 2026)
    expect(summary.donationCount).toBe(0)
    expect(summary.totals).toHaveLength(0)
  })

  it('does not include another user’s donations', async () => {
    const a = await createTestUser({ email: 'y4@test.local' })
    const b = await createTestUser({ email: 'y5@test.local' })

    await createDonation(b, {
      type: 'SADAQAH',
      amount: '999.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    expect((await getDonationYearSummary(a, 2026)).donationCount).toBe(0)
  })
})
