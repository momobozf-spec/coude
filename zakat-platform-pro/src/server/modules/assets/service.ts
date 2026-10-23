import 'server-only'

import type { Asset, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertCanTagHousehold, assertOwner, ownedBy, visibleTo } from '@/server/auth/scope'
import { assertFeature, assertWithinLimit, getLimit } from '@/server/services/entitlements'
import { recordAudit } from '@/server/services/audit'
import { assetTypeMeta } from '@/config/zakat'
import { NotFoundError, ValidationError } from '@/lib/errors'
import type { AssetInputPayload } from '@/modules/zakat/schemas'

/**
 * Asset CRUD (§3, §4).
 *
 * Every read is scoped with `visibleTo` and every write with `ownedBy` /
 * `assertOwner`, so household membership grants sight of a shared position but
 * never the right to change it (§27).
 */

export interface AssetView {
  id: string
  type: Asset['type']
  name: string
  value: string
  currency: string
  zakatablePercentage: string | null
  weightGrams: string | null
  purityKarat: number | null
  notes: string | null
  active: boolean
  householdId: string | null
  /** False when the row belongs to a household member rather than the actor. */
  editable: boolean
  updatedAt: Date
}

function toView(row: Asset, actor: Actor): AssetView {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    value: row.value.toString(),
    currency: row.currency,
    zakatablePercentage: row.zakatablePercentage?.toString() ?? null,
    weightGrams: row.weightGrams?.toString() ?? null,
    purityKarat: row.purityKarat,
    notes: row.notes,
    active: row.active,
    householdId: row.householdId,
    editable: row.userId === actor.userId,
    updatedAt: row.updatedAt,
  }
}

export async function listAssets(
  actor: Actor,
  options: { includeInactive?: boolean } = {},
): Promise<AssetView[]> {
  const rows = await prisma.asset.findMany({
    where: {
      ...visibleTo(actor),
      ...(options.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })

  return rows.map((row) => toView(row, actor))
}

export async function getAsset(actor: Actor, id: string): Promise<AssetView> {
  const row = await prisma.asset.findFirst({ where: { id, ...visibleTo(actor) } })
  if (!row) throw new NotFoundError()
  return toView(row, actor)
}

/**
 * Categories flagged `advanced` or `business` in the config are gated, so the
 * simple mode stays simple and the paid tiers mean something concrete (§15).
 */
function assertCategoryAllowed(actor: Actor, type: Asset['type']): void {
  const meta = assetTypeMeta(type)
  if (!meta) return

  if (meta.business) assertFeature(actor, 'BUSINESS_ASSETS')
  else if (meta.advanced) assertFeature(actor, 'ADVANCED_ASSETS')
}

function assertCurrencyAllowed(actor: Actor, currency: string): void {
  // A second currency is what makes a calculation need FX at all, so that is the
  // point at which MULTI_CURRENCY applies — not the first asset.
  if (currency.toUpperCase() !== actor.defaultCurrency.toUpperCase()) {
    assertFeature(actor, 'MULTI_CURRENCY')
  }
}

function writableData(input: AssetInputPayload, actor: Actor): Prisma.AssetUncheckedCreateInput {
  const usesWeight = Boolean(input.weightGrams)

  if (!usesWeight && !input.value) {
    throw new ValidationError('Vul een waarde in.', { value: ['Vul een waarde in.'] })
  }

  return {
    userId: actor.userId,
    householdId: assertCanTagHousehold(actor, input.householdId ?? null),
    type: input.type,
    name: input.name,
    // A weight-based holding still stores a value column so the row is readable
    // on its own; the engine recomputes it from the price feed at calculation
    // time, which is what keeps a snapshot reproducible.
    value: input.value ?? '0',
    currency: input.currency,
    zakatablePercentage: input.zakatablePercentage ?? null,
    weightGrams: input.weightGrams ?? null,
    purityKarat: input.purityKarat ?? null,
    notes: input.notes ?? null,
  }
}

export async function createAsset(actor: Actor, input: AssetInputPayload): Promise<AssetView> {
  assertCategoryAllowed(actor, input.type)
  assertCurrencyAllowed(actor, input.currency)

  const activeCount = await prisma.asset.count({
    where: { userId: actor.userId, active: true },
  })
  assertWithinLimit(actor, 'assets', activeCount)

  const row = await prisma.asset.create({ data: writableData(input, actor) })

  await recordAudit({
    userId: actor.userId,
    action: 'ASSET_CREATED',
    entityType: 'Asset',
    entityId: row.id,
    // Type and currency are categorical; the amount deliberately stays out (§28).
    metadata: { type: row.type, currency: row.currency },
  })

  return toView(row, actor)
}

export async function updateAsset(
  actor: Actor,
  id: string,
  input: AssetInputPayload & { active?: boolean },
): Promise<AssetView> {
  const existing = await prisma.asset.findUnique({ where: { id } })
  assertOwner(actor, existing)

  assertCategoryAllowed(actor, input.type)
  assertCurrencyAllowed(actor, input.currency)

  const row = await prisma.asset.update({
    where: { id },
    data: { ...writableData(input, actor), active: input.active ?? existing?.active ?? true },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'ASSET_UPDATED',
    entityType: 'Asset',
    entityId: row.id,
    metadata: { type: row.type, currency: row.currency },
  })

  return toView(row, actor)
}

/**
 * Soft delete. A finalised calculation keeps its own copy of every line, so
 * removing an asset can never change history — but keeping the row means a draft
 * can still explain where a figure came from.
 */
export async function deleteAsset(actor: Actor, id: string): Promise<void> {
  const existing = await prisma.asset.findUnique({ where: { id } })
  assertOwner(actor, existing)

  await prisma.asset.update({ where: { id }, data: { active: false } })

  await recordAudit({
    userId: actor.userId,
    action: 'ASSET_DELETED',
    entityType: 'Asset',
    entityId: id,
    metadata: { type: existing?.type },
  })
}

/** How many more the plan allows, for the UI to show before the limit bites. */
export async function assetUsage(actor: Actor) {
  const used = await prisma.asset.count({ where: { userId: actor.userId, active: true } })
  return { used, limit: getLimit(actor, 'assets') }
}

export async function countOwnedAssets(actor: Actor): Promise<number> {
  return prisma.asset.count({ where: { ...ownedBy(actor), active: true } })
}
