import { z } from 'zod'

import { CURRENCY_CODES } from '@/config/currencies'

/**
 * Shared by the client forms and the route handlers, so the browser and the
 * server can never disagree about what is valid.
 *
 * Amounts are validated as decimal *strings*, never coerced to a number: passing
 * a financial value through a JS float even once defeats the point of storing it
 * as Decimal.
 */

const currency = z.enum(CURRENCY_CODES as [string, ...string[]])

/** Up to 2 decimals, non-negative, within the range Decimal(18,2) can hold. */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Vul een bedrag in, bijvoorbeeld 1500 of 1500.50')

/** Up to 3 decimals, non-negative. */
export const gramsString = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'Vul een gewicht in gram in, bijvoorbeeld 120 of 120.500')

export const percentageString = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Vul een percentage tussen 0 en 100 in')
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Het percentage moet tussen 0 en 100 liggen')

export const assetTypeEnum = z.enum([
  'CASH',
  'BANK_ACCOUNT',
  'SAVINGS',
  'GOLD',
  'SILVER',
  'INVESTMENTS',
  'CRYPTO',
  'BUSINESS_CASH',
  'BUSINESS_INVENTORY',
  'RECEIVABLES',
  'PROPERTY_INVESTMENT',
  'OTHER',
])

export const liabilityTypeEnum = z.enum([
  'SHORT_TERM_DEBT',
  'INVOICE_DUE',
  'CREDIT_CARD',
  'TAX_DUE',
  'BUSINESS_PAYABLE',
  'OTHER',
])

// ── Assets ───────────────────────────────────────────────────────────────────

export const assetInputSchema = z
  .object({
    type: assetTypeEnum,
    name: z.string().trim().min(1, 'Geef deze post een naam.').max(120),
    value: moneyString.optional(),
    currency,
    zakatablePercentage: percentageString.nullable().optional(),
    weightGrams: gramsString.nullable().optional(),
    purityKarat: z.number().int().min(1).max(24).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    householdId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Boolean(data.value) || Boolean(data.weightGrams), {
    message: 'Vul een waarde in, of voor goud/zilver een gewicht in gram.',
    path: ['value'],
  })
  .refine(
    (data) => !data.weightGrams || data.type === 'GOLD' || data.type === 'SILVER',
    // A weight on a bank account has no price feed to value it against.
    { message: 'Een gewicht kan alleen bij goud of zilver.', path: ['weightGrams'] },
  )

export type AssetInputPayload = z.infer<typeof assetInputSchema>

export const assetUpdateSchema = assetInputSchema.safeExtend({
  active: z.boolean().optional(),
})

// ── Liabilities ──────────────────────────────────────────────────────────────

export const liabilityInputSchema = z.object({
  type: liabilityTypeEnum,
  name: z.string().trim().min(1, 'Geef deze verplichting een naam.').max(120),
  amount: moneyString,
  currency,
  dueDate: z.coerce.date().nullable().optional(),
  /** Null means "follow the ruleset" — the default and the honest one. */
  deductibleForZakat: z.boolean().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
})

export type LiabilityInputPayload = z.infer<typeof liabilityInputSchema>

export const liabilityUpdateSchema = liabilityInputSchema.safeExtend({
  active: z.boolean().optional(),
})

// ── Zakat profile ────────────────────────────────────────────────────────────

export const zakatProfileSchema = z.object({
  methodology: z.enum(['DEFAULT', 'HANAFI', 'SHAFII', 'MALIKI', 'HANBALI', 'CUSTOM']).optional(),
  nisabBasis: z.enum(['GOLD', 'SILVER', 'CUSTOM']).optional(),
  customNisabValue: moneyString.nullable().optional(),
  customNisabCurrency: currency.nullable().optional(),
  defaultCurrency: currency.optional(),
  haulStartDate: z.coerce.date().nullable().optional(),
  zakatDueDate: z.coerce.date().nullable().optional(),
  preferredCalendar: z.enum(['GREGORIAN', 'HIJRI']).optional(),
  deductShortTermDebts: z.boolean().optional(),
  businessAssetsEnabled: z.boolean().optional(),
  advancedMode: z.boolean().optional(),
  relevantAssetTypes: z.array(assetTypeEnum).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

export type ZakatProfilePayload = z.infer<typeof zakatProfileSchema>

/** A CUSTOM nisab without a value is the one combination that cannot calculate. */
export const zakatProfileRefined = zakatProfileSchema.refine(
  (data) => data.nisabBasis !== 'CUSTOM' || Boolean(data.customNisabValue),
  { message: 'Vul een bedrag in voor je handmatige nisab.', path: ['customNisabValue'] },
)

// ── Onboarding ───────────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = 4

export const onboardingStepSchema = z.object({
  step: z.number().int().min(1).max(ONBOARDING_STEPS),
  defaultCurrency: currency.optional(),
  nisabBasis: z.enum(['GOLD', 'SILVER', 'CUSTOM']).optional(),
  customNisabValue: moneyString.nullable().optional(),
  zakatDueDate: z.coerce.date().nullable().optional(),
  relevantAssetTypes: z.array(assetTypeEnum).optional(),
})

export type OnboardingStepPayload = z.infer<typeof onboardingStepSchema>

// ── Calculation ──────────────────────────────────────────────────────────────

export const WIZARD_STEPS = 8

export const calculationSettingsSchema = z.object({
  calculationDate: z.coerce.date().optional(),
  currency: currency.optional(),
  nisabBasis: z.enum(['GOLD', 'SILVER', 'CUSTOM']).optional(),
  customNisabValue: moneyString.nullable().optional(),
  /** Hand-entered metal prices; when present they replace the price provider. */
  manualGoldPerGram: z.string().trim().nullable().optional(),
  manualSilverPerGram: z.string().trim().nullable().optional(),
})

export type CalculationSettingsPayload = z.infer<typeof calculationSettingsSchema>

export const wizardStepSchema = z.object({
  step: z.number().int().min(1).max(WIZARD_STEPS),
})
