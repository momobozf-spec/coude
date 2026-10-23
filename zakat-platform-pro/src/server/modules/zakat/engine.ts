import { applyPercentage, applyRate, convertMinor, metalValueMinor, sumMinor, toMinorUnits } from '@/lib/money'
import { evaluateAsset } from '@/server/modules/zakat/rules/asset-rule-evaluator'
import { evaluateLiability } from '@/server/modules/zakat/rules/liability-rule-evaluator'
import { ExchangeRateUnavailableAppError } from '@/server/modules/zakat/errors'
import {
  ENGINE_VERSION,
  fxKey,
  type AssetInput,
  type FxRateSnapshot,
  type LiabilityInput,
  type MetalPriceSnapshot,
  type ResultItem,
  type ZakatCalculationResult,
  type ZakatEngineInput,
} from '@/server/modules/zakat/types'

/**
 * The Zakat calculation pipeline (§11).
 *
 * Pure and deterministic: same input, same output, forever. No Prisma, no
 * clock, no network, no AI (§37). Everything it needs — rules, prices, rates —
 * is passed in, which is what allows a finalised calculation to be replayed
 * years later and produce the identical figure.
 *
 *   assets → rules → currency conversion → gross
 *   liabilities → rules → deductible
 *   gross − deductible → net
 *   net vs nisab → rate → due
 */
export function calculateZakat(input: ZakatEngineInput): ZakatCalculationResult {
  const usedRates = new Map<string, FxRateSnapshot>()

  const assetItems = input.assets.map((asset) => evaluateAssetItem(asset, input, usedRates))
  const liabilityItems = input.liabilities.map((liability) =>
    evaluateLiabilityItem(liability, input, usedRates),
  )

  const grossZakatableAssetsMinor = sumMinor(
    assetItems.filter((i) => i.included).map((i) => i.amountMinor),
  )

  const deductibleLiabilitiesMinor = sumMinor(
    liabilityItems.filter((i) => i.included).map((i) => i.amountMinor),
  )

  // Debts exceeding assets leave nothing to tithe, not a negative obligation.
  const netZakatableWealthMinor = Math.max(
    0,
    grossZakatableAssetsMinor - deductibleLiabilitiesMinor,
  )

  // Reaching the nisab exactly counts as reaching it: the threshold is the point
  // at which Zakat becomes due, not a value you must exceed.
  const aboveNisab = netZakatableWealthMinor >= input.nisab.valueMinor

  const zakatDueMinor = aboveNisab
    ? applyRate(netZakatableWealthMinor, input.ruleSet.zakatRate)
    : 0

  return {
    currency: input.currency,
    calculationDate: input.calculationDate,
    engineVersion: ENGINE_VERSION,

    ruleSetId: input.ruleSet.id,
    rulesVersion: input.ruleSet.version,
    methodology: input.methodology,

    grossZakatableAssetsMinor,
    deductibleLiabilitiesMinor,
    netZakatableWealthMinor,

    nisab: input.nisab,
    aboveNisab,

    zakatRate: input.ruleSet.zakatRate,
    zakatDueMinor,

    items: [...assetItems, ...liabilityItems],
    ratesUsed: [...usedRates.values()],
  }
}

// ── Assets ───────────────────────────────────────────────────────────────────

function evaluateAssetItem(
  asset: AssetInput,
  input: ZakatEngineInput,
  usedRates: Map<string, FxRateSnapshot>,
): ResultItem {
  const decision = evaluateAsset(asset, input.ruleSet)

  const valuation = valueAsset(asset, input)

  const converted = convertToCalculationCurrency(
    valuation.minor,
    valuation.currency,
    input,
    usedRates,
  )

  // The percentage is applied after conversion, so a partial share of a foreign
  // holding rounds once against the calculation currency rather than twice.
  const amountMinor = decision.included
    ? applyPercentage(converted.minor, decision.percentage)
    : 0

  return {
    kind: 'ASSET',
    sourceEntityId: asset.id,
    label: asset.name,
    type: asset.type,
    amountMinor,
    originalAmount: valuation.displayAmount,
    originalCurrency: valuation.currency,
    exchangeRate: converted.rate,
    zakatablePercentage: decision.percentage,
    included: decision.included,
    reason: decision.reason,
    ruleBasis: decision.ruleBasis,
  }
}

/**
 * A metal holding entered by weight is valued from the price feed; anything else
 * uses the amount the user typed.
 *
 * This is the one place the asset *type* is inspected, and it is a valuation
 * question ("how many euro is 120 g of gold"), not a religious one — whether
 * gold counts at all is still decided by the ruleset.
 */
function valueAsset(
  asset: AssetInput,
  input: ZakatEngineInput,
): { minor: number; currency: string; displayAmount: string } {
  const price = metalPriceFor(asset, input)

  if (asset.weightGrams && price) {
    return {
      minor: metalValueMinor(asset.weightGrams, price.pricePerGram, price.currency),
      currency: price.currency,
      displayAmount: `${asset.weightGrams} g`,
    }
  }

  return {
    minor: toMinorUnits(asset.value, asset.currency),
    currency: asset.currency,
    displayAmount: asset.value,
  }
}

function metalPriceFor(
  asset: AssetInput,
  input: ZakatEngineInput,
): MetalPriceSnapshot | undefined {
  if (asset.type === 'GOLD') return input.goldPrice
  if (asset.type === 'SILVER') return input.silverPrice
  return undefined
}

// ── Liabilities ──────────────────────────────────────────────────────────────

function evaluateLiabilityItem(
  liability: LiabilityInput,
  input: ZakatEngineInput,
  usedRates: Map<string, FxRateSnapshot>,
): ResultItem {
  const decision = evaluateLiability(
    liability,
    input.ruleSet,
    input.calculationDate,
    input.deductLiabilities,
  )

  const minor = toMinorUnits(liability.amount, liability.currency)
  const converted = convertToCalculationCurrency(minor, liability.currency, input, usedRates)

  return {
    kind: 'LIABILITY',
    sourceEntityId: liability.id,
    label: liability.name,
    type: liability.type,
    amountMinor: decision.deductible ? converted.minor : 0,
    originalAmount: liability.amount,
    originalCurrency: liability.currency,
    exchangeRate: converted.rate,
    zakatablePercentage: null,
    included: decision.deductible,
    reason: decision.reason,
    ruleBasis: decision.ruleBasis,
  }
}

// ── Currency ─────────────────────────────────────────────────────────────────

function convertToCalculationCurrency(
  minor: number,
  from: string,
  input: ZakatEngineInput,
  usedRates: Map<string, FxRateSnapshot>,
): { minor: number; rate: string | null } {
  const source = from.toUpperCase()
  const target = input.currency.toUpperCase()

  if (source === target) return { minor, rate: null }

  const snapshot = input.fx.get(fxKey(source, target))

  // The caller is responsible for pre-loading every rate the assets require. A
  // missing one is a bug in the loader, and guessing here would silently produce
  // a number nobody can trace.
  if (!snapshot) {
    throw new ExchangeRateUnavailableAppError(
      `Geen wisselkoers beschikbaar voor ${source} → ${target}.`,
    )
  }

  usedRates.set(fxKey(source, target), snapshot)

  return { minor: convertMinor(minor, source, target, snapshot.rate), rate: snapshot.rate }
}
