import 'server-only'

import type { CalculationStatus, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertOwner, visibleTo } from '@/server/auth/scope'
import { assertWithinLimit } from '@/server/services/entitlements'
import { auditWithin, recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { minorUnitsToDecimalString, toMinorUnits } from '@/lib/money'
import { startOfYear, endOfYear } from '@/lib/dates'
import { NotFoundError } from '@/lib/errors'
import { calculateZakat } from '@/server/modules/zakat/engine'
import { buildEngineInput, type BuildInputOptions } from '@/server/modules/zakat/input-loader'
import { requireZakatProfile } from '@/server/modules/zakat/profile-service'
import { CalculationAlreadyFinalizedError, CalculationIncompleteError } from '@/server/modules/zakat/errors'
import { WIZARD_STEPS } from '@/modules/zakat/schemas'
import {
  ENGINE_VERSION,
  type ResultItem,
  type ZakatCalculationResult,
} from '@/server/modules/zakat/types'

/**
 * Calculation lifecycle (§11, §14, §15, §16).
 *
 * A DRAFT is a live preview: it is recomputed from current assets, rules and
 * prices every time it is opened, so changing an asset changes the draft.
 *
 * A FINALIZED calculation is the opposite. It is never recomputed. Reading one
 * replays the stored rows — totals, items, rates, nisab price and all — so the
 * figure survives a moving gold price, an edited asset, a deleted asset and a
 * new ruleset version. That asymmetry is the whole point of the model, and
 * `readCalculation` is the only door both go through.
 */

// ── Reading ──────────────────────────────────────────────────────────────────

export interface StoredCalculationView {
  id: string
  status: CalculationStatus
  calculationDate: Date
  zakatYearLabel: string | null
  currency: string

  grossAssetsMinor: number
  deductibleLiabilitiesMinor: number
  netWealthMinor: number

  nisabBasis: string
  nisabValueMinor: number
  nisabMetalGrams: string | null
  nisabPricePerGram: string | null
  nisabPriceProvider: string | null
  nisabPriceSource: string | null
  nisabPriceAsOf: Date | null
  aboveNisab: boolean

  zakatRate: string
  zakatDueMinor: number

  methodology: string
  rulesVersion: string
  ruleSetName: string | null
  engineVersion: string

  wizardStep: number
  finalizedAt: Date | null
  createdAt: Date

  items: Array<{
    kind: 'ASSET' | 'LIABILITY'
    label: string
    amountMinor: number
    originalAmount: string | null
    originalCurrency: string | null
    exchangeRate: string | null
    zakatablePercentage: string | null
    included: boolean
    reason: string | null
    sourceEntityId: string | null
  }>

  rates: Array<{ from: string; to: string; rate: string; provider: string; asOf: Date }>
}

const CALCULATION_INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' } },
  rates: true,
  ruleSet: { select: { name: true } },
} satisfies Prisma.ZakatCalculationInclude

type CalculationRow = Prisma.ZakatCalculationGetPayload<{ include: typeof CALCULATION_INCLUDE }>

function toStoredView(row: CalculationRow): StoredCalculationView {
  const currency = row.currency

  return {
    id: row.id,
    status: row.status,
    calculationDate: row.calculationDate,
    zakatYearLabel: row.zakatYearLabel,
    currency,

    grossAssetsMinor: toMinorUnits(row.grossAssets, currency),
    deductibleLiabilitiesMinor: toMinorUnits(row.deductibleLiabilities, currency),
    netWealthMinor: toMinorUnits(row.netWealth, currency),

    nisabBasis: row.nisabBasis,
    nisabValueMinor: toMinorUnits(row.nisabValue, currency),
    nisabMetalGrams: row.nisabMetalGrams?.toString() ?? null,
    nisabPricePerGram: row.nisabPricePerGram?.toString() ?? null,
    nisabPriceProvider: row.nisabPriceProvider,
    nisabPriceSource: row.nisabPriceSource,
    nisabPriceAsOf: row.nisabPriceAsOf,
    aboveNisab: row.aboveNisab,

    zakatRate: row.zakatRate.toString(),
    zakatDueMinor: toMinorUnits(row.zakatDue, currency),

    methodology: row.methodology,
    rulesVersion: row.rulesVersion,
    ruleSetName: row.ruleSet?.name ?? null,
    engineVersion: row.engineVersion,

    wizardStep: row.wizardStep,
    finalizedAt: row.finalizedAt,
    createdAt: row.createdAt,

    items: row.items.map((item) => ({
      kind: item.itemType === 'LIABILITY' ? ('LIABILITY' as const) : ('ASSET' as const),
      label: item.label,
      amountMinor: toMinorUnits(item.amount, currency),
      originalAmount: item.originalAmount?.toString() ?? null,
      originalCurrency: item.originalCurrency,
      exchangeRate: item.exchangeRate?.toString() ?? null,
      zakatablePercentage: item.zakatablePercentage?.toString() ?? null,
      included: item.included,
      reason: item.reason,
      sourceEntityId: item.sourceEntityId,
    })),

    rates: row.rates.map((rate) => ({
      from: rate.fromCurrency,
      to: rate.toCurrency,
      rate: rate.rate.toString(),
      provider: rate.provider,
      asOf: rate.asOf,
    })),
  }
}

/**
 * Read a stored calculation.
 *
 * This never recomputes, for either status. A finalised row is history; a draft
 * row is whatever the last `recalculateDraft` wrote. Callers who want a fresh
 * draft ask for one explicitly.
 */
export async function readCalculation(
  actor: Actor,
  id: string,
): Promise<StoredCalculationView> {
  const row = await prisma.zakatCalculation.findFirst({
    where: { id, ...visibleTo(actor) },
    include: CALCULATION_INCLUDE,
  })

  if (!row) throw new NotFoundError()
  return toStoredView(row)
}

export async function listCalculations(actor: Actor): Promise<StoredCalculationView[]> {
  const rows = await prisma.zakatCalculation.findMany({
    where: visibleTo(actor),
    include: CALCULATION_INCLUDE,
    orderBy: [{ calculationDate: 'desc' }, { createdAt: 'desc' }],
  })

  return rows.map(toStoredView)
}

// ── Writing ──────────────────────────────────────────────────────────────────

function persistData(
  result: ZakatCalculationResult,
  actor: Actor,
): Prisma.ZakatCalculationUncheckedCreateInput {
  const { currency } = result

  return {
    userId: actor.userId,
    calculationDate: result.calculationDate,
    zakatYearLabel: String(result.calculationDate.getUTCFullYear()),
    currency,

    grossAssets: minorUnitsToDecimalString(result.grossZakatableAssetsMinor, currency),
    deductibleLiabilities: minorUnitsToDecimalString(result.deductibleLiabilitiesMinor, currency),
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
  }
}

function itemRows(
  calculationId: string,
  result: ZakatCalculationResult,
): Prisma.ZakatCalculationItemCreateManyInput[] {
  return result.items.map((item: ResultItem, index) => ({
    calculationId,
    itemType: item.kind,
    sourceEntityId: item.sourceEntityId,
    label: item.label,
    amount: minorUnitsToDecimalString(item.amountMinor, result.currency),
    // A weight-valued asset stores "120 g" here, which is not a decimal — the
    // column only holds a number, so the weight lives in the reason instead.
    originalAmount: isDecimalString(item.originalAmount) ? item.originalAmount : null,
    originalCurrency: item.originalCurrency,
    exchangeRate: item.exchangeRate,
    zakatablePercentage: item.zakatablePercentage,
    included: item.included,
    reason: item.reason,
    sortOrder: index,
  }))
}

function isDecimalString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value)
}

function rateRows(
  calculationId: string,
  result: ZakatCalculationResult,
): Prisma.ZakatCalculationRateCreateManyInput[] {
  return result.ratesUsed.map((rate) => ({
    calculationId,
    fromCurrency: rate.from,
    toCurrency: rate.to,
    rate: rate.rate,
    provider: rate.provider,
    asOf: rate.observedAt,
  }))
}

/**
 * Compute without storing anything — used by the wizard's review step so the
 * user sees the result before committing to a draft row.
 */
export async function previewCalculation(
  actor: Actor,
  options: Partial<BuildInputOptions> = {},
): Promise<ZakatCalculationResult> {
  const profile = await requireZakatProfile(actor)

  const input = await buildEngineInput(actor, profile, {
    calculationDate: options.calculationDate ?? new Date(),
    ...options,
  })

  const result = calculateZakat(input)

  trackEvent('ZAKAT_CALCULATION_PREVIEWED', actor.userId, {
    nisabBasis: result.nisab.basis,
    aboveNisab: result.aboveNisab,
    currency: result.currency,
    rulesVersion: result.rulesVersion,
  })

  return result
}

/**
 * The user's current draft, creating one if none exists.
 *
 * At most one draft exists per user: a second one would leave the wizard
 * ambiguous about which calculation it is editing.
 */
export async function getOrCreateDraft(
  actor: Actor,
  options: Partial<BuildInputOptions> = {},
): Promise<StoredCalculationView> {
  const existing = await prisma.zakatCalculation.findFirst({
    where: { userId: actor.userId, status: 'DRAFT' },
    include: CALCULATION_INCLUDE,
  })

  if (existing) return toStoredView(existing)

  // The per-year cap counts finalised years, not drafts — an abandoned draft
  // should not cost someone their one free calculation.
  await assertCalculationAllowance(actor, new Date())

  const created = await recalculateDraft(actor, null, options)

  trackEvent('ZAKAT_WIZARD_STARTED', actor.userId, { currency: created.currency })

  return created
}

async function assertCalculationAllowance(actor: Actor, date: Date): Promise<void> {
  const year = date.getUTCFullYear()

  const finalizedThisYear = await prisma.zakatCalculation.count({
    where: {
      userId: actor.userId,
      status: 'FINALIZED',
      calculationDate: { gte: startOfYear(year), lt: endOfYear(year) },
    },
  })

  assertWithinLimit(actor, 'calculationsPerYear', finalizedThisYear)
}

/**
 * Recompute the draft from current inputs and store the result.
 *
 * Items and rates are replaced wholesale rather than diffed: a draft is a
 * snapshot of *now*, and a partially updated item list would be a figure nobody
 * could reproduce.
 */
export async function recalculateDraft(
  actor: Actor,
  calculationId: string | null,
  options: Partial<BuildInputOptions> = {},
): Promise<StoredCalculationView> {
  const profile = await requireZakatProfile(actor)

  if (calculationId) {
    const existing = await prisma.zakatCalculation.findUnique({
      where: { id: calculationId },
      select: { userId: true, householdId: true, status: true },
    })
    assertOwner(actor, existing)
    if (existing?.status === 'FINALIZED') throw new CalculationAlreadyFinalizedError()
  }

  const input = await buildEngineInput(actor, profile, {
    calculationDate: options.calculationDate ?? new Date(),
    ...options,
  })

  const result = calculateZakat(input)
  const data = persistData(result, actor)

  const row = await prisma.$transaction(async (tx) => {
    const calculation = calculationId
      ? await tx.zakatCalculation.update({
          where: { id: calculationId },
          data: { ...data, userId: undefined },
        })
      : await tx.zakatCalculation.create({ data })

    await tx.zakatCalculationItem.deleteMany({ where: { calculationId: calculation.id } })
    await tx.zakatCalculationRate.deleteMany({ where: { calculationId: calculation.id } })

    await tx.zakatCalculationItem.createMany({ data: itemRows(calculation.id, result) })
    await tx.zakatCalculationRate.createMany({ data: rateRows(calculation.id, result) })

    await auditWithin(tx, {
      userId: actor.userId,
      action: calculationId ? 'CALCULATION_RECALCULATED' : 'CALCULATION_CREATED',
      entityType: 'ZakatCalculation',
      entityId: calculation.id,
      metadata: {
        rulesVersion: result.rulesVersion,
        engineVersion: result.engineVersion,
        nisabBasis: result.nisab.basis,
      },
    })

    return tx.zakatCalculation.findUniqueOrThrow({
      where: { id: calculation.id },
      include: CALCULATION_INCLUDE,
    })
  })

  return toStoredView(row)
}

/** Persist wizard position. Cheap and frequent, so it touches one column. */
export async function saveWizardStep(
  actor: Actor,
  calculationId: string,
  step: number,
): Promise<void> {
  const existing = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true, status: true },
  })
  assertOwner(actor, existing)
  if (existing?.status === 'FINALIZED') throw new CalculationAlreadyFinalizedError()

  await prisma.zakatCalculation.update({
    where: { id: calculationId },
    data: { wizardStep: Math.min(Math.max(step, 1), WIZARD_STEPS) },
  })

  trackEvent('ZAKAT_WIZARD_STEP_COMPLETED', actor.userId, { step })
}

/**
 * Finalise a draft into an immutable snapshot (§15, §16).
 *
 * Everything happens in one transaction: ownership check, fresh deterministic
 * recomputation, rules and nisab and FX captured, items written, status flipped.
 * The recomputation is deliberate — finalising must record what is true at that
 * moment, not whatever the draft happened to hold from an earlier session.
 */
export async function finalizeCalculation(
  actor: Actor,
  calculationId: string,
): Promise<StoredCalculationView> {
  const existing = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true, status: true, calculationDate: true },
  })

  assertOwner(actor, existing)
  if (!existing) throw new NotFoundError()

  // Finalising twice would silently restate a historical figure.
  if (existing.status === 'FINALIZED') throw new CalculationAlreadyFinalizedError()

  const profile = await requireZakatProfile(actor)

  await assertCalculationAllowance(actor, existing.calculationDate)

  const input = await buildEngineInput(actor, profile, {
    calculationDate: existing.calculationDate,
  })

  if (input.assets.length === 0) {
    throw new CalculationIncompleteError(
      ['assets'],
      'Voeg minstens één vermogenspost toe voordat je de berekening afrondt.',
    )
  }

  const result = calculateZakat(input)
  const data = persistData(result, actor)
  const finalizedAt = new Date()

  const row = await prisma.$transaction(async (tx) => {
    await tx.zakatCalculation.update({
      where: { id: calculationId },
      data: {
        ...data,
        userId: undefined,
        status: 'FINALIZED',
        finalizedAt,
        wizardStep: WIZARD_STEPS,
      },
    })

    await tx.zakatCalculationItem.deleteMany({ where: { calculationId } })
    await tx.zakatCalculationRate.deleteMany({ where: { calculationId } })

    await tx.zakatCalculationItem.createMany({ data: itemRows(calculationId, result) })
    await tx.zakatCalculationRate.createMany({ data: rateRows(calculationId, result) })

    await auditWithin(tx, {
      userId: actor.userId,
      action: 'CALCULATION_FINALIZED',
      entityType: 'ZakatCalculation',
      entityId: calculationId,
      metadata: {
        rulesVersion: result.rulesVersion,
        engineVersion: ENGINE_VERSION,
        nisabBasis: result.nisab.basis,
        aboveNisab: result.aboveNisab,
      },
    })

    return tx.zakatCalculation.findUniqueOrThrow({
      where: { id: calculationId },
      include: CALCULATION_INCLUDE,
    })
  })

  trackEvent('ZAKAT_CALCULATION_FINALIZED', actor.userId, {
    nisabBasis: result.nisab.basis,
    aboveNisab: result.aboveNisab,
    currency: result.currency,
    rulesVersion: result.rulesVersion,
  })

  return toStoredView(row)
}

/** Discard a draft. Finalised rows are never deletable through this path. */
export async function discardDraft(actor: Actor, calculationId: string): Promise<void> {
  const existing = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true, status: true },
  })

  assertOwner(actor, existing)
  if (existing?.status === 'FINALIZED') throw new CalculationAlreadyFinalizedError()

  await prisma.zakatCalculation.delete({ where: { id: calculationId } })

  await recordAudit({
    userId: actor.userId,
    action: 'CALCULATION_ARCHIVED',
    entityType: 'ZakatCalculation',
    entityId: calculationId,
  })
}
