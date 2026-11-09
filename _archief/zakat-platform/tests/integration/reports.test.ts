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
  voidDonation,
} from '@/server/modules/donations/service'
import { registerZakatPayment } from '@/server/modules/donations/payment-service'
import { buildAnnualReport, reportYears } from '@/server/modules/reports/annual-report'
import {
  generateAnnualReport,
  listGeneratedReports,
  readGeneratedReport,
  readReportBytes,
} from '@/server/modules/reports/service'
import { InMemoryFileStorage } from '@/server/storage/memory'
import { TextReportRenderer } from '@/server/modules/reports/renderer'
import { ReportNotAvailableError } from '@/server/modules/reminders/errors'
import { NotFoundError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'

/**
 * Annual reports against a real database (§46, §47, §48).
 */

const suite = hasDatabase ? describe : describe.skip

const NOW = new Date('2026-12-31T12:00:00.000Z')

async function userWithZakat(email: string): Promise<{ actor: Actor; calculationId: string }> {
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

  return { actor, calculationId: finalized.id }
}

suite('annual report data', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('reports Zakat due, paid and remaining', async () => {
    const { actor, calculationId } = await userWithZakat('rep1@test.local')

    await registerZakatPayment(actor, calculationId, {
      amount: '800.00',
      donatedAt: new Date('2026-04-01T00:00:00Z'),
    })

    const year = new Date().getUTCFullYear()
    const report = await buildAnnualReport(actor, year, NOW)

    const entry = report.zakatYears.find((z) => z.calculationId === calculationId)
    expect(entry?.zakatDueMinor).toBe(137_500)
    expect(entry?.paidMinor).toBe(80_000)
    expect(entry?.remainingMinor).toBe(57_500)
    expect(entry?.status).toBe('PARTIALLY_PAID')
  })

  it('shows an overpayment as a difference', async () => {
    const { actor, calculationId } = await userWithZakat('rep2@test.local')

    await registerZakatPayment(actor, calculationId, {
      amount: '1500.00',
      donatedAt: new Date('2026-04-01T00:00:00Z'),
    })

    const report = await buildAnnualReport(actor, new Date().getUTCFullYear(), NOW)
    const entry = report.zakatYears[0]

    expect(entry?.status).toBe('OVERPAID')
    expect(entry?.overpaidMinor).toBe(12_500)
    expect(entry?.remainingMinor).toBe(0)
  })

  it('totals Sadaqah separately from Zakat', async () => {
    const actor = await createTestUser({ email: 'rep3@test.local' })

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
      donatedAt: new Date('2026-07-10T00:00:00Z'),
    })

    const report = await buildAnnualReport(actor, 2026, NOW)

    expect(report.donationCount).toBe(2)
    expect(report.totals).toEqual([{ currency: 'EUR', amountMinor: 35_000, count: 2 }])
    expect(report.byType.map((t) => t.type).sort()).toEqual(['SADAQAH', 'SADAQAH_JARIYAH'])
  })

  it('excludes a voided donation', async () => {
    const actor = await createTestUser({ email: 'rep4@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })
    await voidDonation(actor, donation.id)

    const report = await buildAnnualReport(actor, 2026, NOW)

    expect(report.donationCount).toBe(0)
    expect(report.totals).toHaveLength(0)
  })

  it('counts a correction once, not twice', async () => {
    const actor = await createTestUser({ email: 'rep5@test.local' })

    const original = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    await correctDonation(actor, original.id, {
      type: 'SADAQAH',
      amount: '150.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const report = await buildAnnualReport(actor, 2026, NOW)

    expect(report.donationCount).toBe(1)
    expect(report.totals[0]?.amountMinor).toBe(15_000)
  })

  it('keeps currencies separate', async () => {
    const actor = await createTestUser({ email: 'rep6@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })
    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '350.00',
      currency: 'MAD',
      donatedAt: new Date('2026-04-10T00:00:00Z'),
    })

    const report = await buildAnnualReport(actor, 2026, NOW)

    // Never summed with today's rate (§28).
    expect(report.mixedCurrency).toBe(true)
    expect(report.totals.map((t) => t.currency).sort()).toEqual(['EUR', 'MAD'])
  })

  it('uses the historical charity name after a rename', async () => {
    const actor = await createTestUser({ email: 'rep7@test.local' })

    const charity = await prisma.charity.create({
      data: {
        slug: 'rep-charity',
        name: 'Oorspronkelijke naam',
        country: 'BE',
        website: 'https://example.org',
      },
    })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
      charityId: charity.id,
    })

    await prisma.charity.update({ where: { id: charity.id }, data: { name: 'Nieuwe naam' } })

    const report = await buildAnnualReport(actor, 2026, NOW)

    expect(report.byRecipient[0]?.label).toBe('Oorspronkelijke naam')
  })

  it('flags donations that have a receipt attached', async () => {
    const actor = await createTestUser({ email: 'rep8@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const storage = new InMemoryFileStorage()
    const { uploadDonationReceipt } = await import(
      '@/server/modules/donations/receipt-service'
    )
    await uploadDonationReceipt(
      actor,
      donation.id,
      {
        fileName: 'bewijs.pdf',
        mimeType: 'application/pdf',
        body: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32, 0x20)]),
      },
      storage,
    )

    const report = await buildAnnualReport(actor, 2026, NOW)

    expect(report.receiptsAttached).toBe(1)
    expect(report.byRecipient[0]?.withReceipt).toBe(1)
  })

  it('returns an empty report for a year with nothing in it', async () => {
    const actor = await createTestUser({ email: 'rep9@test.local' })

    const report = await buildAnnualReport(actor, 2019, NOW)

    expect(report.donationCount).toBe(0)
    expect(report.zakatYears).toHaveLength(0)
    expect(report.disclaimer).toContain('geen fiscaal attest')
  })

  it('lists the years with activity', async () => {
    const actor = await createTestUser({ email: 'rep10@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '10.00',
      currency: 'EUR',
      donatedAt: new Date('2024-03-10T00:00:00Z'),
    })
    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '10.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    expect(await reportYears(actor)).toEqual([2026, 2024])
  })

  it('never includes another user’s donations', async () => {
    const a = await createTestUser({ email: 'rep11@test.local' })
    const b = await createTestUser({ email: 'rep12@test.local' })

    await createDonation(b, {
      type: 'SADAQAH',
      amount: '999.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    expect((await buildAnnualReport(a, 2026, NOW)).donationCount).toBe(0)
  })
})

suite('report snapshots', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  const options = () => ({
    renderer: new TextReportRenderer(),
    storage: new InMemoryFileStorage(),
    now: NOW,
  })

  it('freezes the data and stores a file', async () => {
    const actor = await createTestUser({ email: 's1@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const generated = await generateAnnualReport(actor, 2026, options())

    expect(generated.sequence).toBe(1)
    expect(generated.hasFile).toBe(true)
    expect(generated.downloadUrl).toContain('token=')

    const { data } = await readGeneratedReport(actor, generated.id)
    expect(data.donationCount).toBe(1)
  })

  it('does not change when a donation is voided afterwards', async () => {
    const actor = await createTestUser({ email: 's2@test.local' })

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const generated = await generateAnnualReport(actor, 2026, options())
    await voidDonation(actor, donation.id)

    // The snapshot is history; the live preview is not.
    const { data } = await readGeneratedReport(actor, generated.id)
    expect(data.donationCount).toBe(1)

    const live = await buildAnnualReport(actor, 2026, NOW)
    expect(live.donationCount).toBe(0)
  })

  it('does not change when a charity is renamed afterwards', async () => {
    const actor = await createTestUser({ email: 's3@test.local' })

    const charity = await prisma.charity.create({
      data: {
        slug: 's3-charity',
        name: 'Naam bij generatie',
        country: 'BE',
        website: 'https://example.org',
      },
    })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
      charityId: charity.id,
    })

    const generated = await generateAnnualReport(actor, 2026, options())
    await prisma.charity.update({ where: { id: charity.id }, data: { name: 'Andere naam' } })

    const { data } = await readGeneratedReport(actor, generated.id)
    expect(data.byRecipient[0]?.label).toBe('Naam bij generatie')
  })

  it('keeps earlier snapshots when regenerating', async () => {
    const actor = await createTestUser({ email: 's4@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const first = await generateAnnualReport(actor, 2026, options())

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-04-10T00:00:00Z'),
    })

    const second = await generateAnnualReport(actor, 2026, options())

    expect(second.sequence).toBe(2)

    const older = await readGeneratedReport(actor, first.id)
    const newer = await readGeneratedReport(actor, second.id)

    expect(older.data.donationCount).toBe(1)
    expect(newer.data.donationCount).toBe(2)
    expect(await listGeneratedReports(actor, 2026)).toHaveLength(2)
  })

  it('stores the file under a generated key and serves it to the owner only', async () => {
    const storage = new InMemoryFileStorage()
    const actor = await createTestUser({ email: 's5@test.local' })
    const stranger = await createTestUser({ email: 's6@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const generated = await generateAnnualReport(actor, 2026, {
      renderer: new TextReportRenderer(),
      storage,
      now: NOW,
    })

    const report = await prisma.annualReport.findUniqueOrThrow({
      where: { id: generated.id },
      include: { document: true },
    })

    expect(report.document?.storageKey).toMatch(
      new RegExp(`^reports/${actor.userId}/[0-9a-f-]{36}\\.txt$`),
    )

    const owned = await readReportBytes(actor, report.documentId!, storage)
    expect(owned.body.toString('utf8')).toContain('2026')

    await expect(readReportBytes(stranger, report.documentId!, storage)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('refuses to read another user’s snapshot', async () => {
    const actor = await createTestUser({ email: 's7@test.local' })
    const stranger = await createTestUser({ email: 's8@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '100.00',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    const generated = await generateAnnualReport(actor, 2026, options())

    await expect(readGeneratedReport(stranger, generated.id)).rejects.toThrow(
      ReportNotAvailableError,
    )
    expect(await listGeneratedReports(stranger)).toHaveLength(0)
  })

  it('records generation in the audit trail without amounts', async () => {
    const actor = await createTestUser({ email: 's9@test.local' })

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '123456.78',
      currency: 'EUR',
      donatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    await generateAnnualReport(actor, 2026, options())

    const entries = await prisma.auditLog.findMany({ where: { userId: actor.userId } })
    expect(entries.map((e) => e.action)).toContain('REPORT_GENERATED')
    expect(JSON.stringify(entries)).not.toContain('123456.78')
  })
})
