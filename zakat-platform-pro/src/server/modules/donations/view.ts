import type { Donation, Prisma } from '@/generated/prisma/client'

import type { Actor } from '@/server/auth/actor'
import { toMinorUnits } from '@/lib/money'

/**
 * The shape a donation takes once it leaves the server.
 *
 * Kept in its own module so the donation service and the payment service can
 * both use it without importing each other — the payment service builds on
 * `createDonation`, so the dependency has to run one way only.
 *
 * Amounts leave as both the exact decimal string and minor units. The UI formats
 * from minor units; nothing downstream ever parses a formatted figure back.
 */

export interface DonationView {
  id: string
  type: Donation['type']
  status: Donation['status']

  amount: string
  amountMinor: number
  currency: string

  donatedAt: Date

  charityId: string | null
  /** Live name when the charity still exists, else the snapshot taken at the time. */
  recipientLabel: string

  paymentMethod: Donation['paymentMethod']
  reference: string | null
  notes: string | null

  zakatCalculationId: string | null
  receiptDocumentId: string | null
  receiptFileName: string | null

  voidedAt: Date | null
  voidReason: string | null
  replacesDonationId: string | null

  householdId: string | null
  /** False for a household member's row, and for anything already voided. */
  editable: boolean

  createdAt: Date
  updatedAt: Date
}

export const DONATION_INCLUDE = {
  charity: { select: { name: true } },
  receipt: { select: { id: true, fileName: true } },
} satisfies Prisma.DonationInclude

export type DonationRow = Prisma.DonationGetPayload<{ include: typeof DONATION_INCLUDE }>

export function toDonationView(row: DonationRow, actor: Actor): DonationView {
  return {
    id: row.id,
    type: row.type,
    status: row.status,

    amount: row.amount.toString(),
    amountMinor: toMinorUnits(row.amount, row.currency),
    currency: row.currency,

    donatedAt: row.donatedAt,

    charityId: row.charityId,
    // Falls back through the snapshot before the free-text recipient, so a
    // renamed or unlinked charity still reads correctly in an old year (§6).
    recipientLabel:
      row.charity?.name ??
      row.charityNameSnapshot ??
      row.recipientName ??
      'Onbekende ontvanger',

    paymentMethod: row.paymentMethod,
    reference: row.reference,
    notes: row.notes,

    zakatCalculationId: row.zakatCalculationId,
    receiptDocumentId: row.receiptDocumentId,
    receiptFileName: row.receipt?.fileName ?? null,

    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    replacesDonationId: row.replacesDonationId,

    householdId: row.householdId,
    editable: row.userId === actor.userId && row.status === 'ACTIVE',

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
