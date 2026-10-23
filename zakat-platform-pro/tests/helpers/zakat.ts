import type {
  AssetInput,
  FxRateSnapshot,
  LiabilityInput,
  MetalPriceSnapshot,
  RuleSetSnapshot,
} from '@/server/modules/zakat/types'
import { fxKey } from '@/server/modules/zakat/types'

/**
 * Builders for engine tests.
 *
 * The default ruleset mirrors what `prisma/seed/rulesets.ts` writes, so a test
 * that passes here describes the behaviour a seeded database actually produces.
 */

export const DEFAULT_ASSET_TYPES = [
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
] as const

export const DEDUCTIBLE_LIABILITY_TYPES = [
  'SHORT_TERM_DEBT',
  'INVOICE_DUE',
  'CREDIT_CARD',
  'TAX_DUE',
  'BUSINESS_PAYABLE',
] as const

export function makeRuleSet(overrides: Partial<RuleSetSnapshot> = {}): RuleSetSnapshot {
  const assetRules: RuleSetSnapshot['assetRules'] = new Map(
    DEFAULT_ASSET_TYPES.map((type) => [
      type,
      {
        assetType: type,
        zakatable: true,
        defaultZakatablePercentage: '100',
        rationale: `${type} telt volledig mee.`,
      },
    ]),
  )

  const liabilityRules: RuleSetSnapshot['liabilityRules'] = new Map(
    DEDUCTIBLE_LIABILITY_TYPES.map((type) => [
      type,
      {
        liabilityType: type,
        deductibleByDefault: true,
        maxMonthsAhead: 12,
        rationale: 'Aftrekbaar binnen twaalf maanden.',
      },
    ]),
  )

  liabilityRules.set('OTHER', {
    liabilityType: 'OTHER',
    deductibleByDefault: false,
    maxMonthsAhead: null,
    rationale: 'Niet automatisch aftrekbaar.',
  })

  return {
    id: 'ruleset-1',
    version: '2026.1-default',
    name: 'Standaardmethode',
    methodology: 'DEFAULT',
    zakatRate: '0.025',
    goldNisabGrams: '85',
    silverNisabGrams: '595',
    allowLiabilityDeduction: true,
    assetRules,
    liabilityRules,
    ...overrides,
  }
}

let assetCounter = 0

export function makeAsset(overrides: Partial<AssetInput> = {}): AssetInput {
  assetCounter += 1
  return {
    id: `asset-${assetCounter}`,
    type: 'SAVINGS',
    name: 'Spaargeld',
    value: '1000.00',
    currency: 'EUR',
    zakatablePercentage: null,
    weightGrams: null,
    ...overrides,
  }
}

let liabilityCounter = 0

export function makeLiability(overrides: Partial<LiabilityInput> = {}): LiabilityInput {
  liabilityCounter += 1
  return {
    id: `liability-${liabilityCounter}`,
    type: 'SHORT_TERM_DEBT',
    name: 'Schuld',
    amount: '100.00',
    currency: 'EUR',
    dueDate: null,
    deductibleForZakat: null,
    ...overrides,
  }
}

export function makeMetalPrice(overrides: Partial<MetalPriceSnapshot> = {}): MetalPriceSnapshot {
  return {
    pricePerGram: '75.000000',
    currency: 'EUR',
    provider: 'fixture',
    sourceType: 'FIXTURE',
    observedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

export function makeFxTable(rates: FxRateSnapshot[]): Map<string, FxRateSnapshot> {
  return new Map(rates.map((r) => [fxKey(r.from, r.to), r]))
}

export function makeRate(
  from: string,
  to: string,
  rate: string,
  overrides: Partial<FxRateSnapshot> = {},
): FxRateSnapshot {
  return {
    from,
    to,
    rate,
    provider: 'fixture',
    observedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

export const CALCULATION_DATE = new Date('2026-08-07T00:00:00.000Z')
