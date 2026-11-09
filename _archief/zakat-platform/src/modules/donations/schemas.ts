import { z } from 'zod'

import { CURRENCY_CODES } from '@/config/currencies'
import { moneyString } from '@/modules/zakat/schemas'

/**
 * Shared by the donation forms and the route handlers (§34).
 *
 * Amounts stay decimal strings all the way to the money helpers — a financial
 * value that passes through a JS float even once has lost the guarantee the
 * whole engine is built on.
 */

const currency = z.enum(CURRENCY_CODES as [string, ...string[]])

export const donationTypeEnum = z.enum([
  'ZAKAT',
  'SADAQAH',
  'SADAQAH_JARIYAH',
  'FIDYA',
  'KAFFARAH',
  'WAQF',
  'OTHER',
])

export type DonationTypeValue = z.infer<typeof donationTypeEnum>

export const paymentMethodEnum = z.enum([
  'BANK_TRANSFER',
  'CARD',
  'CASH',
  'DIRECT_DEBIT',
  'IN_KIND',
  'OTHER',
])

/** Positive, at most two decimals. Zero and negative are rejected here (§34). */
export const positiveMoneyString = moneyString.refine(
  (value) => Number(value) > 0,
  'Een donatie moet groter zijn dan nul.',
)

const baseDonation = z.object({
  type: donationTypeEnum,
  amount: positiveMoneyString,
  currency,
  donatedAt: z.coerce.date(),

  charityId: z.string().uuid().nullable().optional(),
  recipientName: z.string().trim().max(160).nullable().optional(),

  paymentMethod: paymentMethodEnum.nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),

  zakatCalculationId: z.string().uuid().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
})

/**
 * A calculation link only makes sense for a ZAKAT donation: allowing it for a
 * Sadaqah payment would let voluntary giving silently settle an obligation (§34).
 */
const rejectNonZakatAllocation = (data: { type: string; zakatCalculationId?: string | null }) =>
  !data.zakatCalculationId || data.type === 'ZAKAT'

const ALLOCATION_MESSAGE =
  'Alleen een Zakat-donatie kan aan een Zakat-berekening gekoppeld worden.'

export const donationCreateSchema = baseDonation
  .safeExtend({
    /** Client-generated per form session; a retry reuses it (§37). */
    idempotencyKey: z.string().trim().min(8).max(64).optional(),
  })
  .refine(rejectNonZakatAllocation, {
    message: ALLOCATION_MESSAGE,
    path: ['zakatCalculationId'],
  })

export type DonationCreatePayload = z.infer<typeof donationCreateSchema>

export const donationUpdateSchema = baseDonation.refine(rejectNonZakatAllocation, {
  message: ALLOCATION_MESSAGE,
  path: ['zakatCalculationId'],
})

export type DonationUpdatePayload = z.infer<typeof donationUpdateSchema>

export const donationVoidSchema = z.object({
  reason: z.string().trim().max(300).optional(),
})

/** Registering a payment straight from a finalised calculation (§24). */
export const zakatPaymentSchema = z.object({
  amount: positiveMoneyString,
  donatedAt: z.coerce.date(),
  charityId: z.string().uuid().nullable().optional(),
  recipientName: z.string().trim().max(160).nullable().optional(),
  paymentMethod: paymentMethodEnum.nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
})

export type ZakatPaymentPayload = z.infer<typeof zakatPaymentSchema>

// ── History filters ──────────────────────────────────────────────────────────

export const donationFilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  type: donationTypeEnum.optional(),
  charityId: z.string().uuid().optional(),
  currency: currency.optional(),
  includeVoided: z.coerce.boolean().optional(),
})

export type DonationFilterPayload = z.infer<typeof donationFilterSchema>

// ── Sadaqah goals ────────────────────────────────────────────────────────────

export const sadaqahPeriodEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])

export const sadaqahGoalCreateSchema = z.object({
  label: z.string().trim().max(120).nullable().optional(),
  amount: positiveMoneyString,
  currency,
  period: sadaqahPeriodEnum,
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
})

export type SadaqahGoalCreatePayload = z.infer<typeof sadaqahGoalCreateSchema>

export const sadaqahGoalUpdateSchema = sadaqahGoalCreateSchema.safeExtend({
  active: z.boolean().optional(),
})

export type SadaqahGoalUpdatePayload = z.infer<typeof sadaqahGoalUpdateSchema>
