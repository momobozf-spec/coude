import type { CharitySourceType } from '@/generated/prisma/client'

/**
 * Source reliability hierarchy (§5).
 *
 * The tier expresses **how independent the evidence is**, not whether the claim
 * it supports is true. A government register is independent of the charity; the
 * charity's own website is not. That distinction changes how much weight a
 * verified claim earns — it never turns an unevidenced claim into a true one.
 *
 * Kept in code rather than a database column so the hierarchy is versioned with
 * the scoring rules it feeds, and cannot drift out of sync with them.
 */

export type SourceTier = 'INDEPENDENT' | 'PROFESSIONAL' | 'ORGANISATION' | 'UNCLASSIFIED'

export interface SourceTierDefinition {
  tier: SourceTier
  /** Multiplier applied to a factor's weight. Never above 1. */
  weight: number
  label: string
  description: string
}

export const SOURCE_TIERS: Record<SourceTier, SourceTierDefinition> = {
  INDEPENDENT: {
    tier: 'INDEPENDENT',
    weight: 1,
    label: 'Onafhankelijke bron',
    description: 'Een register of toezichthouder buiten de organisatie zelf.',
  },
  PROFESSIONAL: {
    tier: 'PROFESSIONAL',
    weight: 0.9,
    label: 'Professionele controle',
    description: 'Een gecontroleerd rapport of een externe beoordeling.',
  },
  ORGANISATION: {
    tier: 'ORGANISATION',
    weight: 0.7,
    label: 'Door de organisatie gepubliceerd',
    description:
      'De organisatie publiceert dit zelf. Dat is bruikbaar bewijs dat het gepubliceerd ís, ' +
      'maar het is geen onafhankelijke bevestiging van de inhoud.',
  },
  UNCLASSIFIED: {
    tier: 'UNCLASSIFIED',
    weight: 0.5,
    label: 'Overige bron',
    description: 'Een bron die niet in een van de bovenstaande categorieën valt.',
  },
}

export const SOURCE_TYPE_TIERS: Record<CharitySourceType, SourceTier> = {
  GOVERNMENT_REGISTER: 'INDEPENDENT',
  AUDITED_REPORT: 'PROFESSIONAL',
  INDEPENDENT_REVIEW: 'PROFESSIONAL',
  FINANCIAL_REPORT: 'ORGANISATION',
  ANNUAL_REPORT: 'ORGANISATION',
  ZAKAT_POLICY: 'ORGANISATION',
  OFFICIAL_WEBSITE: 'ORGANISATION',
  OTHER: 'UNCLASSIFIED',
}

export const SOURCE_TYPE_LABELS: Record<CharitySourceType, string> = {
  GOVERNMENT_REGISTER: 'Officieel register',
  AUDITED_REPORT: 'Gecontroleerd rapport',
  INDEPENDENT_REVIEW: 'Onafhankelijke beoordeling',
  FINANCIAL_REPORT: 'Financieel rapport',
  ANNUAL_REPORT: 'Jaarverslag',
  ZAKAT_POLICY: 'Zakat-beleid',
  OFFICIAL_WEBSITE: 'Officiële website',
  OTHER: 'Overige bron',
}

export function tierOf(sourceType: CharitySourceType): SourceTierDefinition {
  return SOURCE_TIERS[SOURCE_TYPE_TIERS[sourceType]]
}

/**
 * Whether a source is independent of the charity it describes.
 *
 * This is the gate for `verified` and for the strongest Zakat label: a charity's
 * own page can never be the sole evidence for either (§11, §13).
 */
export function isIndependent(sourceType: CharitySourceType): boolean {
  const tier = SOURCE_TYPE_TIERS[sourceType]
  return tier === 'INDEPENDENT' || tier === 'PROFESSIONAL'
}
