import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createTestUser, prisma, resetDatabase } from './setup'
import { createDonation, voidDonation } from '@/server/modules/donations/service'
import {
  archiveSadaqahGoal,
  createSadaqahGoal,
  getSadaqahGoalProgress,
  listSadaqahGoalProgress,
} from '@/server/modules/donations/sadaqah-service'
import {
  deleteDonationReceipt,
  getDonationReceipt,
  readReceiptBytes,
  uploadDonationReceipt,
} from '@/server/modules/donations/receipt-service'
import { InMemoryFileStorage } from '@/server/storage/memory'
import {
  InvalidReceiptTypeError,
  ReceiptTooLargeError,
  SadaqahGoalNotFoundError,
} from '@/server/modules/donations/errors'
import { NotFoundError } from '@/lib/errors'
import { MAX_RECEIPT_BYTES } from '@/server/storage/types'

/**
 * Sadaqah goals and receipts against a real database (§40, §41, §43).
 */

const suite = hasDatabase ? describe : describe.skip

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20)])
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0),
])

suite('sadaqah goals', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function goalFor(email: string, period: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
    const actor = await createTestUser({ email })
    const goal = await createSadaqahGoal(actor, {
      label: 'Maandelijkse Sadaqah',
      amount: '50.00',
      currency: 'EUR',
      period,
      startDate: new Date('2026-01-01T00:00:00Z'),
    })
    return { actor, goal }
  }

  it('walks the specification flow: €20, then €30, then complete', async () => {
    const { actor, goal } = await goalFor('g1@test.local')
    const now = new Date('2026-08-08T12:00:00Z')

    expect((await getSadaqahGoalProgress(actor, goal.id, now)).achievedMinor).toBe(0)

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    const partial = await getSadaqahGoalProgress(actor, goal.id, now)
    expect(partial.achievedMinor).toBe(2_000)
    expect(partial.percentage).toBe(40)
    expect(partial.reached).toBe(false)

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '30.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-07T00:00:00Z'),
    })

    const complete = await getSadaqahGoalProgress(actor, goal.id, now)
    expect(complete.achievedMinor).toBe(5_000)
    expect(complete.percentage).toBe(100)
    expect(complete.reached).toBe(true)
    expect(complete.remainingMinor).toBe(0)
  })

  it('counts Sadaqah Jariyah too', async () => {
    const { actor, goal } = await goalFor('g2@test.local')

    await createDonation(actor, {
      type: 'SADAQAH_JARIYAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    const progress = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-08-08T00:00:00Z'))
    expect(progress.achievedMinor).toBe(5_000)
  })

  it('never counts Zakat towards a Sadaqah goal', async () => {
    const { actor, goal } = await goalFor('g3@test.local')

    await createDonation(actor, {
      type: 'ZAKAT',
      amount: '500.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    // An obligation is not voluntary giving; conflating them would misreport both.
    const progress = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-08-08T00:00:00Z'))
    expect(progress.achievedMinor).toBe(0)
  })

  it('ignores donations outside the current period', async () => {
    const { actor, goal } = await goalFor('g4@test.local')

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '40.00',
      currency: 'EUR',
      donatedAt: new Date('2026-07-15T00:00:00Z'),
    })

    const august = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-08-08T00:00:00Z'))
    expect(august.achievedMinor).toBe(0)

    const july = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-07-20T00:00:00Z'))
    expect(july.achievedMinor).toBe(4_000)
  })

  it('measures a yearly goal across the whole year', async () => {
    const { actor, goal } = await goalFor('g5@test.local', 'YEARLY')

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date('2026-02-01T00:00:00Z'),
    })
    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '20.00',
      currency: 'EUR',
      donatedAt: new Date('2026-09-01T00:00:00Z'),
    })

    const progress = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-10-01T00:00:00Z'))
    expect(progress.achievedMinor).toBe(4_000)
  })

  it('excludes a voided donation', async () => {
    const { actor, goal } = await goalFor('g6@test.local')

    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    await voidDonation(actor, donation.id)

    const progress = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-08-08T00:00:00Z'))
    expect(progress.achievedMinor).toBe(0)
  })

  it('ignores a donation in a different currency', async () => {
    const { actor, goal } = await goalFor('g7@test.local')

    await createDonation(actor, {
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'USD',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    // Converting would put a figure in the bar the user never gave in that currency.
    const progress = await getSadaqahGoalProgress(actor, goal.id, new Date('2026-08-08T00:00:00Z'))
    expect(progress.achievedMinor).toBe(0)
  })

  it('archives without deleting, and drops out of the active list', async () => {
    const { actor, goal } = await goalFor('g8@test.local')

    const archived = await archiveSadaqahGoal(actor, goal.id)
    expect(archived.active).toBe(false)
    expect(archived.archivedAt).toBeTruthy()

    expect(await listSadaqahGoalProgress(actor)).toHaveLength(0)
    expect(await prisma.sadaqahGoal.count({ where: { id: goal.id } })).toBe(1)
  })

  it('does not expose another user’s goal', async () => {
    const { goal } = await goalFor('g9@test.local')
    const stranger = await createTestUser({ email: 'g10@test.local' })

    await expect(getSadaqahGoalProgress(stranger, goal.id)).rejects.toThrow(
      SadaqahGoalNotFoundError,
    )
  })

  it('counts only the owner’s giving, even for a shared goal', async () => {
    const owner = await createTestUser({ email: 'g11@test.local' })
    const member = await createTestUser({ email: 'g12@test.local' })

    const household = await prisma.household.create({
      data: {
        name: 'Familie',
        ownerUserId: owner.userId,
        members: {
          create: [
            { userId: owner.userId, role: 'OWNER', sharesFinancials: true },
            { userId: member.userId, role: 'MEMBER', sharesFinancials: true },
          ],
        },
      },
    })

    const ownerScoped = {
      ...owner,
      households: [{ householdId: household.id, role: 'OWNER' as const, sharesFinancials: true }],
    }

    const goal = await createSadaqahGoal(ownerScoped, {
      amount: '50.00',
      currency: 'EUR',
      period: 'MONTHLY',
      startDate: new Date('2026-01-01T00:00:00Z'),
      householdId: household.id,
    })

    await createDonation(member, {
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })

    // Somebody else's giving does not fill your goal.
    const progress = await getSadaqahGoalProgress(
      ownerScoped,
      goal.id,
      new Date('2026-08-08T00:00:00Z'),
    )
    expect(progress.achievedMinor).toBe(0)
  })
})

suite('receipts', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function donationFor(email: string) {
    const actor = await createTestUser({ email })
    const donation = await createDonation(actor, {
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date('2026-08-05T00:00:00Z'),
    })
    return { actor, donation }
  }

  it('accepts a PDF and links it to the donation', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r1@test.local')

    const receipt = await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'bewijs.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    expect(receipt.fileName).toBe('bewijs.pdf')
    expect(receipt.downloadUrl).toContain('/api/documents/')
    expect(receipt.downloadUrl).toContain('token=')
    // Never a path under public/.
    expect(receipt.downloadUrl).not.toContain('/uploads/')

    const row = await prisma.donation.findUniqueOrThrow({ where: { id: donation.id } })
    expect(row.receiptDocumentId).toBe(receipt.documentId)
  })

  it('accepts a PNG', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r2@test.local')

    const receipt = await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'foto.png', mimeType: 'image/png', body: PNG },
      storage,
    )

    expect(receipt.mimeType).toBe('image/png')
  })

  it('rejects a disallowed MIME type', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r3@test.local')

    await expect(
      uploadDonationReceipt(
        actor,
        donation.id,
        { fileName: 'script.html', mimeType: 'text/html', body: Buffer.from('<h1>x</h1>') },
        storage,
      ),
    ).rejects.toThrow(InvalidReceiptTypeError)

    expect(storage.size).toBe(0)
  })

  it('rejects a file whose contents contradict its declared type', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r4@test.local')

    // An executable renamed to .pdf and declared as a PDF.
    await expect(
      uploadDonationReceipt(
        actor,
        donation.id,
        { fileName: 'bewijs.pdf', mimeType: 'application/pdf', body: Buffer.from('MZ\x90\x00') },
        storage,
      ),
    ).rejects.toThrow(InvalidReceiptTypeError)

    expect(storage.size).toBe(0)
  })

  it('rejects an oversized file', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r5@test.local')

    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.7\n'),
      Buffer.alloc(MAX_RECEIPT_BYTES + 1024, 0x20),
    ])

    await expect(
      uploadDonationReceipt(
        actor,
        donation.id,
        { fileName: 'groot.pdf', mimeType: 'application/pdf', body: oversized },
        storage,
      ),
    ).rejects.toThrow(ReceiptTooLargeError)
  })

  it('stores under a generated key, never the user’s filename', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r6@test.local')

    const receipt = await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: '../../etc/passwd.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    const document = await prisma.document.findUniqueOrThrow({
      where: { id: receipt.documentId },
    })

    expect(document.storageKey).toMatch(
      new RegExp(`^receipts/${actor.userId}/[0-9a-f-]{36}\\.pdf$`),
    )
    expect(document.storageKey).not.toContain('..')
    expect(document.fileName).not.toContain('/')
  })

  it('denies another user access to the bytes', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r7@test.local')
    const stranger = await createTestUser({ email: 'r8@test.local' })

    const receipt = await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'bewijs.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    // Even holding the document id, a stranger gets 404 rather than the file.
    await expect(readReceiptBytes(stranger, receipt.documentId, storage)).rejects.toThrow(
      NotFoundError,
    )

    const owned = await readReceiptBytes(actor, receipt.documentId, storage)
    expect(owned.body).toEqual(PDF)
  })

  it('denies another user the metadata and the signed link', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r9@test.local')
    const stranger = await createTestUser({ email: 'r10@test.local' })

    await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'bewijs.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    await expect(getDonationReceipt(stranger, donation.id)).rejects.toThrow(NotFoundError)
  })

  it('removes the file and the link when deleted', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r11@test.local')

    const receipt = await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'bewijs.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    await deleteDonationReceipt(actor, donation.id, storage)

    expect(storage.size).toBe(0)
    expect(await prisma.document.count({ where: { id: receipt.documentId } })).toBe(0)

    const row = await prisma.donation.findUniqueOrThrow({ where: { id: donation.id } })
    expect(row.receiptDocumentId).toBeNull()
  })

  it('records the upload in the audit trail without the filename', async () => {
    const storage = new InMemoryFileStorage()
    const { actor, donation } = await donationFor('r12@test.local')

    await uploadDonationReceipt(
      actor,
      donation.id,
      { fileName: 'privé-bankafschrift.pdf', mimeType: 'application/pdf', body: PDF },
      storage,
    )

    const entries = await prisma.auditLog.findMany({ where: { userId: actor.userId } })
    expect(entries.map((e) => e.action)).toContain('RECEIPT_UPLOADED')
    expect(JSON.stringify(entries)).not.toContain('privé-bankafschrift')
  })
})
