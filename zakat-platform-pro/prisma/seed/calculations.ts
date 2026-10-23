import type { PrismaClient } from '@/generated/prisma/client'

import { calculateZakat } from '../../src/server/modules/zakat/engine'
import { computeNisab } from '../../src/server/modules/zakat/nisab'
import { FixtureMetalPriceProvider } from '../../src/server/integrations/metal-prices/fixture'
import { FixtureExchangeRateProvider } from '../../src/server/integrations/exchange-rates/fixture'
import { minorUnitsToDecimalString } from '../../src/lib/money'
import {
  fxKey,
  type FxRateSnapshot,
  type RuleSetSnapshot,
} from '../../src/server/modules/zakat/types'

/**
 * A draft calculation for the development user (§32).
 *
 * This imports the *pure* engine directly rather than going through the
 * application service, because the service layer is marked `server-only` and a
 * seed script is not a server component. That the engine can be driven straight
 * from a plain Node script is exactly what its purity is for.
 *
 * The result is left as a DRAFT: seeding a finalised calculation would present a
 * worked religious example as though it were settled advice (§32).
 */

export async function seedDraftCalculation(prisma: PrismaClient, userId: string) {
  const profile = await prisma.zakatProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const ruleSetRow = await prisma.zakatRuleSet.findFirst({
    where: { active: true },
    include: { assetRules: true, liabilityRules: true },
  })
  if (!ruleSetRow) return null

  const currency = profile.defaultCurrency
  const calculationDate = new Date('2026-08-07T00:00:00.000Z')

  const ruleSet: RuleSetSnapshot = {
    id: ruleSetRow.id,
    version: ruleSetRow.version,
    name: ruleSetRow.name,
    methodology: ruleSetRow.methodology,
    zakatRate: ruleSetRow.zakatRate.toString(),
    goldNisabGrams: ruleSetRow.goldNisabGrams.toString(),
    silverNisabGrams: ruleSetRow.silverNisabGrams.toString(),
    allowLiabilityDeduction: ruleSetRow.allowLiabilityDeduction,
    assetRules: new Map(
      ruleSetRow.assetRules.map((r) => [
        r.assetType,
        {
          assetType: r.assetType,
          zakatable: r.zakatable,
          defaultZakatablePercentage: r.defaultZakatablePercentage.toString(),
          rationale: r.rationale,
        },
      ]),
    ),
    liabilityRules: new Map(
      ruleSetRow.liabilityRules.map((r) => [
        r.liabilityType,
        {
          liabilityType: r.liabilityType,
          deductibleByDefault: r.deductibleByDefault,
          maxMonthsAhead: r.maxMonthsAhead,
          rationale: r.rationale,
        },
      ]),
    ),
  }

  const [assetRows, liabilityRows] = await Promise.all([
    prisma.asset.findMany({ where: { userId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.liability.findMany({ where: { userId, active: true }, orderBy: { createdAt: 'asc' } }),
  ])

  const metals = new FixtureMetalPriceProvider()
  const fx = new FixtureExchangeRateProvider()

  const [gold, silver] = await Promise.all([
    metals.getGoldPrice(currency),
    metals.getSilverPrice(currency),
  ])

  const toSnapshot = (price: Awaited<ReturnType<typeof metals.getGoldPrice>>) => ({
    pricePerGram: price.pricePerGram,
    currency: price.currency,
    provider: price.provider,
    sourceType: price.sourceType,
    observedAt: price.observedAt,
  })

  // One lookup per distinct foreign currency, same as the real loader.
  const foreign = new Set(
    [...assetRows, ...liabilityRows]
      .map((r) => r.currency.toUpperCase())
      .filter((c) => c !== currency.toUpperCase()),
  )

  const rates = await Promise.all(
    [...foreign].map(async (from) => {
      const rate = await fx.getRate(from, currency)
      return {
        from: rate.from,
        to: rate.to,
        rate: rate.rate,
        provider: rate.provider,
        observedAt: rate.observedAt,
      } satisfies FxRateSnapshot
    }),
  )

  const nisab = computeNisab({
    basis: profile.nisabBasis,
    currency,
    ruleSet,
    metalPrice: profile.nisabBasis === 'GOLD' ? toSnapshot(gold) : toSnapshot(silver),
    customValue: profile.customNisabValue?.toString() ?? null,
  })

  const result = calculateZakat({
    calculationDate,
    currency,
    methodology: profile.methodology,
    ruleSet,
    assets: assetRows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      value: row.value.toString(),
      currency: row.currency,
      zakatablePercentage: row.zakatablePercentage?.toString() ?? null,
      weightGrams: row.weightGrams?.toString() ?? null,
    })),
    liabilities: liabilityRows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      amount: row.amount.toString(),
      currency: row.currency,
      dueDate: row.dueDate,
      deductibleForZakat: row.deductibleForZakat,
    })),
    nisab,
    fx: new Map(rates.map((r) => [fxKey(r.from, r.to), r])),
    deductLiabilities: profile.deductShortTermDebts,
    goldPrice: toSnapshot(gold),
    silverPrice: toSnapshot(silver),
  })

  // Idempotent: drafts are replaced, finalised rows are never touched.
  await prisma.zakatCalculation.deleteMany({ where: { userId, status: 'DRAFT' } })

  const calculation = await prisma.zakatCalculation.create({
    data: {
      userId,
      calculationDate,
      zakatYearLabel: '2026',
      currency,
      grossAssets: minorUnitsToDecimalString(result.grossZakatableAssetsMinor, currency),
      deductibleLiabilities: minorUnitsToDecimalString(
        result.deductibleLiabilitiesMinor,
        currency,
      ),
      netWealth: minorUnitsToDecimalString(result.netZakatableWealthMinor, currency),
      nisabBasis: result.nisab.basis,
      nisabValue: minorUnitsToDecimalString(result.nisab.valueMinor, currency),
      nisabMetalGrams: result.nisab.metalWeightGrams,
      nisabPricePerGram: result.nisab.pricePerGram,
      nisabPriceCurrency: result.nisab.currency,
      nisabPriceSource: result.nisab.priceSourceType,
      nisabPriceProvider: result.nisab.priceProvider,
      nisabPriceAsOf: result.nisab.priceObservedAt,
      aboveNisab: result.aboveNisab,
      zakatRate: result.zakatRate,
      zakatDue: minorUnitsToDecimalString(result.zakatDueMinor, currency),
      methodology: result.methodology,
      ruleSetId: result.ruleSetId,
      rulesVersion: result.rulesVersion,
      engineVersion: result.engineVersion,
      status: 'DRAFT',
      wizardStep: 8,
    },
  })

  await prisma.zakatCalculationItem.createMany({
    data: result.items.map((item, index) => ({
      calculationId: calculation.id,
      itemType: item.kind,
      sourceEntityId: item.sourceEntityId,
      label: item.label,
      amount: minorUnitsToDecimalString(item.amountMinor, currency),
      originalAmount: /^-?\d+(\.\d+)?$/.test(item.originalAmount) ? item.originalAmount : null,
      originalCurrency: item.originalCurrency,
      exchangeRate: item.exchangeRate,
      zakatablePercentage: item.zakatablePercentage,
      included: item.included,
      reason: item.reason,
      sortOrder: index,
    })),
  })

  await prisma.zakatCalculationRate.createMany({
    data: result.ratesUsed.map((rate) => ({
      calculationId: calculation.id,
      fromCurrency: rate.from,
      toCurrency: rate.to,
      rate: rate.rate,
      provider: rate.provider,
      asOf: rate.observedAt,
    })),
  })

  return { id: calculation.id, zakatDueMinor: result.zakatDueMinor, currency }
}
