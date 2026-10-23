import type { AssetType, LiabilityType } from '@/generated/prisma/client'

/**
 * Presentation metadata for the wealth categories (§8, §10).
 *
 * Deliberately *not* the place for religious rules — whether a category is
 * zakatable and at what percentage lives in the versioned ZakatRuleSet rows so it
 * can be sourced and changed without a deploy (§38).
 */

export type AssetInputMode = 'VALUE' | 'WEIGHT_OR_VALUE'

export interface AssetTypeMeta {
  type: AssetType
  label: string
  hint: string
  inputMode: AssetInputMode
  /** Hidden behind advanced mode (§15). */
  advanced: boolean
  /** Only offered when the profile has businessAssetsEnabled. */
  business: boolean
}

export const ASSET_TYPES: readonly AssetTypeMeta[] = [
  {
    type: 'CASH',
    label: 'Contant geld',
    hint: 'Cash thuis of in een kluis',
    inputMode: 'VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'BANK_ACCOUNT',
    label: 'Bankrekening',
    hint: 'Zichtrekening of betaalrekening',
    inputMode: 'VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'SAVINGS',
    label: 'Spaargeld',
    hint: 'Spaarrekening of termijnrekening',
    inputMode: 'VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'GOLD',
    label: 'Goud',
    hint: 'In gram of in huidige waarde',
    inputMode: 'WEIGHT_OR_VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'SILVER',
    label: 'Zilver',
    hint: 'In gram of in huidige waarde',
    inputMode: 'WEIGHT_OR_VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'INVESTMENTS',
    label: 'Beleggingen',
    hint: 'Aandelen, fondsen, pensioenbeleggingen',
    inputMode: 'VALUE',
    advanced: false,
    business: false,
  },
  {
    type: 'CRYPTO',
    label: 'Crypto',
    hint: 'Waarde op je peildatum',
    inputMode: 'VALUE',
    advanced: true,
    business: false,
  },
  {
    type: 'RECEIVABLES',
    label: 'Uitstaande vorderingen',
    hint: 'Geld dat je te goed hebt en verwacht terug te krijgen',
    inputMode: 'VALUE',
    advanced: true,
    business: false,
  },
  {
    type: 'PROPERTY_INVESTMENT',
    label: 'Vastgoed als belegging',
    hint: 'Niet je eigen woning — vastgoed dat je aanhoudt om te verhandelen',
    inputMode: 'VALUE',
    advanced: true,
    business: false,
  },
  {
    type: 'BUSINESS_CASH',
    label: 'Zakelijke liquide middelen',
    hint: 'Kasgeld en rekeningen van je onderneming',
    inputMode: 'VALUE',
    advanced: true,
    business: true,
  },
  {
    type: 'BUSINESS_INVENTORY',
    label: 'Handelsvoorraad',
    hint: 'Goederen bestemd voor verkoop',
    inputMode: 'VALUE',
    advanced: true,
    business: true,
  },
  {
    type: 'OTHER',
    label: 'Overig',
    hint: 'Iets dat niet in de lijst past',
    inputMode: 'VALUE',
    advanced: true,
    business: false,
  },
] as const

export interface LiabilityTypeMeta {
  type: LiabilityType
  label: string
  hint: string
  advanced: boolean
}

export const LIABILITY_TYPES: readonly LiabilityTypeMeta[] = [
  {
    type: 'SHORT_TERM_DEBT',
    label: 'Korte termijn schuld',
    hint: 'Schuld die je binnen een jaar moet aflossen',
    advanced: false,
  },
  {
    type: 'CREDIT_CARD',
    label: 'Kredietkaart',
    hint: 'Openstaand saldo op je peildatum',
    advanced: false,
  },
  {
    type: 'INVOICE_DUE',
    label: 'Openstaande factuur',
    hint: 'Factuur die je nog moet betalen',
    advanced: false,
  },
  {
    type: 'TAX_DUE',
    label: 'Verschuldigde belasting',
    hint: 'Aanslag die al vaststaat',
    advanced: true,
  },
  {
    type: 'BUSINESS_PAYABLE',
    label: 'Zakelijke schuld',
    hint: 'Openstaande verplichting van je onderneming',
    advanced: true,
  },
  { type: 'OTHER', label: 'Overig', hint: 'Andere verplichting', advanced: true },
] as const

const ASSET_BY_TYPE = new Map(ASSET_TYPES.map((a) => [a.type, a]))
const LIABILITY_BY_TYPE = new Map(LIABILITY_TYPES.map((l) => [l.type, l]))

export function assetTypeMeta(type: AssetType): AssetTypeMeta | undefined {
  return ASSET_BY_TYPE.get(type)
}

export function liabilityTypeMeta(type: LiabilityType): LiabilityTypeMeta | undefined {
  return LIABILITY_BY_TYPE.get(type)
}

/**
 * The ruleset the application falls back to when a user has no explicit choice.
 * Seeded by prisma/seed and referenced by every calculation for reproducibility.
 */
export const DEFAULT_RULE_SET_VERSION = '2026.1-default'
