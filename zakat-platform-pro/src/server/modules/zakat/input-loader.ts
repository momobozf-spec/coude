import 'server-only'

import type { NisabBasis, ZakatProfile } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { loadActiveRuleSet } from '@/server/modules/zakat/rules/ruleset-loader'
import { computeNisab } from '@/server/modules/zakat/nisab'
import { getMetalPriceProvider } from '@/server/integrations/metal-prices'
import { getExchangeRateProvider } from '@/server/integrations/exchange-rates'
import {
  MetalPriceUnavailableError,
  type MetalPriceProvider,
} from '@/server/integrations/metal-prices/types'
import { ExchangeRateUnavailableError } from '@/server/integrations/exchange-rates/types'
import {
  ExchangeRateUnavailableAppError,
  MetalPriceUnavailableAppError,
} from '@/server/modules/zakat/errors'
import {
  fxKey,
  type AssetInput,
  type FxRateSnapshot,
  type LiabilityInput,
  type MetalPriceSnapshot,
  type ZakatEngineInput,
} from '@/server/modules/zakat/types'

/**
 * Assembles everything the engine needs, in batches (§35).
 *
 * One query for the ruleset with its rules, one for assets, one for liabilities,
 * and one provider call per distinct currency pair and metal. There is no
 * per-asset lookup anywhere: a user with fifty positions costs the same number
 * of round-trips as one with three.
 */

export interface BuildInputOptions {
  calculationDate: Date
  currency?: string
  nisabBasis?: NisabBasis
  customNisabValue?: string | null
  manualGoldPerGram?: string | null
  manualSilverPerGram?: string | null
}

export async function buildEngineInput(
  actor: Actor,
  profile: ZakatProfile,
  options: BuildInputOptions,
): Promise<ZakatEngineInput> {
  const currency = (options.currency ?? profile.defaultCurrency).toUpperCase()
  const nisabBasis = options.nisabBasis ?? profile.nisabBasis

  // Only the actor's own positions enter their calculation. A household member's
  // shared assets are visible on the dashboard but are that member's wealth, and
  // rolling them into someone else's Zakat would be wrong (§40, §27).
  const [ruleSet, assetRows, liabilityRows] = await Promise.all([
    loadActiveRuleSet(),
    prisma.asset.findMany({
      where: { userId: actor.userId, active: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.liability.findMany({
      where: { userId: actor.userId, active: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  const assets: AssetInput[] = assetRows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    value: row.value.toString(),
    currency: row.currency,
    zakatablePercentage: row.zakatablePercentage?.toString() ?? null,
    weightGrams: row.weightGrams?.toString() ?? null,
  }))

  const liabilities: LiabilityInput[] = liabilityRows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    amount: row.amount.toString(),
    currency: row.currency,
    dueDate: row.dueDate,
    deductibleForZakat: row.deductibleForZakat,
  }))

  const manual =
    options.manualGoldPerGram || options.manualSilverPerGram
      ? {
          goldPerGram: options.manualGoldPerGram ?? undefined,
          silverPerGram: options.manualSilverPerGram ?? undefined,
          currency,
        }
      : undefined

  const metalProvider = manual || needsMetalPrice(nisabBasis, assets) ? getMetalPriceProvider(manual) : null

  const [fx, goldPrice, silverPrice] = await Promise.all([
    loadFxTable([...assets, ...liabilities], currency),
    metalProvider && needsGold(nisabBasis, assets)
      ? fetchPrice(metalProvider, 'GOLD', currency)
      : Promise.resolve(undefined),
    metalProvider && needsSilver(nisabBasis, assets)
      ? fetchPrice(metalProvider, 'SILVER', currency)
      : Promise.resolve(undefined),
  ])

  const nisab = computeNisab({
    basis: nisabBasis,
    currency,
    ruleSet,
    metalPrice: nisabBasis === 'GOLD' ? goldPrice : nisabBasis === 'SILVER' ? silverPrice : undefined,
    customValue: options.customNisabValue ?? profile.customNisabValue?.toString() ?? null,
  })

  return {
    calculationDate: options.calculationDate,
    currency,
    methodology: profile.methodology,
    ruleSet,
    assets,
    liabilities,
    nisab,
    fx,
    deductLiabilities: profile.deductShortTermDebts,
    goldPrice,
    silverPrice,
  }
}

// ── Which providers are actually needed ──────────────────────────────────────

function hasWeighted(assets: readonly AssetInput[], type: 'GOLD' | 'SILVER'): boolean {
  return assets.some((a) => a.type === type && Boolean(a.weightGrams))
}

function needsGold(basis: NisabBasis, assets: readonly AssetInput[]): boolean {
  return basis === 'GOLD' || hasWeighted(assets, 'GOLD')
}

function needsSilver(basis: NisabBasis, assets: readonly AssetInput[]): boolean {
  return basis === 'SILVER' || hasWeighted(assets, 'SILVER')
}

function needsMetalPrice(basis: NisabBasis, assets: readonly AssetInput[]): boolean {
  return needsGold(basis, assets) || needsSilver(basis, assets)
}

async function fetchPrice(
  provider: MetalPriceProvider,
  metal: 'GOLD' | 'SILVER',
  currency: string,
): Promise<MetalPriceSnapshot> {
  try {
    const price =
      metal === 'GOLD'
        ? await provider.getGoldPrice(currency)
        : await provider.getSilverPrice(currency)

    return {
      pricePerGram: price.pricePerGram,
      currency: price.currency,
      provider: price.provider,
      sourceType: price.sourceType,
      observedAt: price.observedAt,
    }
  } catch (error) {
    // Provider internals never reach the client (§36).
    throw new MetalPriceUnavailableAppError(
      error instanceof MetalPriceUnavailableError
        ? error.message
        : `De ${metal === 'GOLD' ? 'goud' : 'zilver'}prijs kon niet worden opgehaald.`,
    )
  }
}

/**
 * Fetch every rate the positions require, once per distinct pair.
 *
 * Ten assets in USD produce a single USD→EUR lookup, and the resulting snapshot
 * is what gets written into the calculation so the figure can be reproduced.
 */
async function loadFxTable(
  rows: ReadonlyArray<{ currency: string }>,
  target: string,
): Promise<Map<string, FxRateSnapshot>> {
  const sources = new Set(
    rows.map((r) => r.currency.toUpperCase()).filter((c) => c !== target.toUpperCase()),
  )

  if (sources.size === 0) return new Map()

  const provider = getExchangeRateProvider()

  const results = await Promise.all(
    [...sources].map(async (source) => {
      try {
        const rate = await provider.getRate(source, target)
        return {
          from: rate.from,
          to: rate.to,
          rate: rate.rate,
          provider: rate.provider,
          observedAt: rate.observedAt,
        } satisfies FxRateSnapshot
      } catch (error) {
        throw new ExchangeRateUnavailableAppError(
          error instanceof ExchangeRateUnavailableError
            ? error.message
            : `De wisselkoers ${source} → ${target} kon niet worden opgehaald.`,
        )
      }
    }),
  )

  return new Map(results.map((r) => [fxKey(r.from, r.to), r]))
}
