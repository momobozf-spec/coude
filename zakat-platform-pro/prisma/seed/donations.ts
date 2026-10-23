import type { PrismaClient } from '@/generated/prisma/client'

/**
 * Donation, payment and Sadaqah demo data (§44).
 *
 * Deliberate choices here:
 *
 *  • The finalised calculation is left **partially paid**, so the payment
 *    tracking UI has something to show on first run rather than a completed
 *    state that hides the interesting behaviour.
 *  • A receipt row is seeded as *metadata only*, pointing at a storage key that
 *    holds no real file. Shipping an actual document — even a fake one — would
 *    put a sample "financial record" in every developer's checkout.
 *  • Idempotent: donations for the seeded user are cleared and rewritten, and
 *    the finalised calculation is reused if it already exists.
 */

export async function seedFinalizedCalculation(prisma: PrismaClient, userId: string) {
  const existing = await prisma.zakatCalculation.findFirst({
    where: { userId, status: 'FINALIZED', zakatYearLabel: '2025' },
  })
  if (existing) return existing

  const ruleSet = await prisma.zakatRuleSet.findFirst({ where: { active: true } })
  if (!ruleSet) return null

  const calculationDate = new Date('2025-03-15T00:00:00.000Z')

  // Hand-computed so the demo is a worked example the numbers can be checked
  // against: €55,000 net × 2.5% = €1,375.00.
  const calculation = await prisma.zakatCalculation.create({
    data: {
      userId,
      calculationDate,
      zakatYearLabel: '2025',
      currency: 'EUR',

      grossAssets: '58500.00',
      deductibleLiabilities: '3500.00',
      netWealth: '55000.00',

      nisabBasis: 'SILVER',
      nisabValue: '505.75',
      nisabMetalGrams: '595',
      nisabPricePerGram: '0.850000',
      nisabPriceCurrency: 'EUR',
      nisabPriceSource: 'FIXTURE',
      nisabPriceProvider: 'fixture',
      nisabPriceAsOf: new Date('2025-03-15T00:00:00.000Z'),
      aboveNisab: true,

      zakatRate: '0.025',
      zakatDue: '1375.00',

      methodology: 'DEFAULT',
      ruleSetId: ruleSet.id,
      rulesVersion: ruleSet.version,
      engineVersion: 'zakat-engine@1',

      status: 'FINALIZED',
      finalizedAt: new Date('2025-03-16T09:00:00.000Z'),
      wizardStep: 8,

      items: {
        create: [
          {
            itemType: 'ASSET',
            label: 'Spaargeld',
            amount: '35000.00',
            originalAmount: '35000.00',
            originalCurrency: 'EUR',
            zakatablePercentage: '100',
            included: true,
            reason: 'Spaargeld telt volledig mee.',
            sortOrder: 0,
          },
          {
            itemType: 'ASSET',
            label: 'Beleggingsrekening',
            amount: '15000.00',
            originalAmount: '15000.00',
            originalCurrency: 'EUR',
            zakatablePercentage: '100',
            included: true,
            reason: 'Beleggingen tellen standaard volledig mee.',
            sortOrder: 1,
          },
          {
            itemType: 'ASSET',
            label: 'Sieraden',
            amount: '8500.00',
            originalAmount: '8500.00',
            originalCurrency: 'EUR',
            zakatablePercentage: '100',
            included: true,
            reason: 'Goud telt mee op basis van de waarde op je peildatum.',
            sortOrder: 2,
          },
          {
            itemType: 'LIABILITY',
            label: 'Lening familie',
            amount: '3500.00',
            originalAmount: '3500.00',
            originalCurrency: 'EUR',
            included: true,
            reason: 'Schulden die binnen twaalf maanden opeisbaar zijn, zijn aftrekbaar.',
            sortOrder: 3,
          },
        ],
      },
    },
  })

  return calculation
}

export async function seedDonationsAndGoals(
  prisma: PrismaClient,
  userId: string,
  calculationId: string | null,
) {
  const charities = await prisma.charity.findMany({ select: { id: true, slug: true, name: true } })
  const bySlug = new Map(charities.map((c) => [c.slug, c]))

  // Replace wholesale so a re-seed cannot accumulate duplicates.
  await prisma.donation.deleteMany({ where: { userId } })
  await prisma.document.deleteMany({ where: { userId, type: 'DONATION_RECEIPT' } })
  await prisma.sadaqahGoal.deleteMany({ where: { userId } })

  const noodhulp = bySlug.get('demo-noodhulp-alliantie')
  const waterbron = bySlug.get('demo-waterbron')
  const moskee = bySlug.get('demo-buurtmoskee')

  const year = new Date().getUTCFullYear()
  const month = new Date().getUTCMonth()

  // ── Zakat payments: €800 of €1,375, so the year reads PARTIALLY_PAID ──
  if (calculationId) {
    await prisma.donation.create({
      data: {
        userId,
        type: 'ZAKAT',
        amount: '500.00',
        currency: 'EUR',
        donatedAt: new Date('2025-03-20T00:00:00.000Z'),
        charityId: noodhulp?.id ?? null,
        charityNameSnapshot: noodhulp?.name ?? null,
        paymentMethod: 'BANK_TRANSFER',
        zakatCalculationId: calculationId,
        reference: 'Zakat 2025 — deel 1',
      },
    })

    await prisma.donation.create({
      data: {
        userId,
        type: 'ZAKAT',
        amount: '300.00',
        currency: 'EUR',
        donatedAt: new Date('2025-03-22T00:00:00.000Z'),
        charityId: waterbron?.id ?? null,
        charityNameSnapshot: waterbron?.name ?? null,
        paymentMethod: 'BANK_TRANSFER',
        zakatCalculationId: calculationId,
        reference: 'Zakat 2025 — deel 2',
      },
    })

    // A voided payment: proves in the UI that intrekken removes an amount from
    // the total while the record itself stays visible and auditable (§7).
    await prisma.donation.create({
      data: {
        userId,
        type: 'ZAKAT',
        amount: '150.00',
        currency: 'EUR',
        donatedAt: new Date('2025-03-23T00:00:00.000Z'),
        recipientName: 'Dubbel geregistreerd',
        zakatCalculationId: calculationId,
        status: 'VOIDED',
        voidedAt: new Date('2025-03-24T00:00:00.000Z'),
        voidReason: 'Per ongeluk twee keer ingevoerd',
      },
    })
  }

  // ── Sadaqah, including this month so the goal has visible progress ──
  const sadaqah = await prisma.donation.create({
    data: {
      userId,
      type: 'SADAQAH',
      amount: '35.00',
      currency: 'EUR',
      donatedAt: new Date(Date.UTC(year, month, 5)),
      charityId: moskee?.id ?? null,
      charityNameSnapshot: moskee?.name ?? null,
      paymentMethod: 'CARD',
    },
  })

  await prisma.donation.create({
    data: {
      userId,
      type: 'SADAQAH_JARIYAH',
      amount: '340.00',
      currency: 'EUR',
      donatedAt: new Date(Date.UTC(year, 1, 11)),
      charityId: waterbron?.id ?? null,
      charityNameSnapshot: waterbron?.name ?? null,
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Bijdrage aan een waterput',
    },
  })

  await prisma.donation.create({
    data: {
      userId,
      type: 'SADAQAH',
      amount: '50.00',
      currency: 'EUR',
      donatedAt: new Date(Date.UTC(year, Math.max(0, month - 1), 12)),
      recipientName: 'Lokale voedselbank',
      paymentMethod: 'CASH',
    },
  })

  // ── Receipt metadata only: no real file is written (§44) ──
  const receipt = await prisma.document.create({
    data: {
      userId,
      type: 'DONATION_RECEIPT',
      fileName: 'demo-bewijsstuk.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24_576,
      storageProvider: 'LOCAL',
      // Points at nothing on disk on purpose — downloading it will 404, which is
      // the honest outcome for demo metadata.
      storageKey: `receipts/${userId}/seed-demo-receipt.pdf`,
      checksumSha256: null,
    },
  })

  await prisma.donation.update({
    where: { id: sadaqah.id },
    data: { receiptDocumentId: receipt.id },
  })

  // ── A €50/month Sadaqah goal, currently at €35 ──
  const goal = await prisma.sadaqahGoal.create({
    data: {
      userId,
      label: 'Maandelijkse Sadaqah',
      amount: '50.00',
      currency: 'EUR',
      period: 'MONTHLY',
      startDate: new Date(Date.UTC(year, 0, 1)),
      active: true,
    },
  })

  return { goalId: goal.id, receiptId: receipt.id }
}
