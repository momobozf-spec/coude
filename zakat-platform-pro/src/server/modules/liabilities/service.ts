import 'server-only'

import type { Liability, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertCanTagHousehold, assertOwner, visibleTo } from '@/server/auth/scope'
import { assertFeature, assertWithinLimit, getLimit } from '@/server/services/entitlements'
import { recordAudit } from '@/server/services/audit'
import { liabilityTypeMeta } from '@/config/zakat'
import { NotFoundError } from '@/lib/errors'
import type { LiabilityInputPayload } from '@/modules/zakat/schemas'

/**
 * Liability CRUD (§5).
 *
 * Note what this service does *not* do: it never decides that an obligation is
 * deductible. `deductibleForZakat` is stored as a nullable override and stays
 * null unless the user says otherwise — the ruleset decides at calculation time,
 * and the reason is shown on the line.
 */

export interface LiabilityView {
  id: string
  type: Liability['type']
  name: string
  amount: string
  currency: string
  dueDate: Date | null
  deductibleForZakat: boolean | null
  notes: string | null
  active: boolean
  householdId: string | null
  editable: boolean
  updatedAt: Date
}

function toView(row: Liability, actor: Actor): LiabilityView {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    amount: row.amount.toString(),
    currency: row.currency,
    dueDate: row.dueDate,
    deductibleForZakat: row.deductibleForZakat,
    notes: row.notes,
    active: row.active,
    householdId: row.householdId,
    editable: row.userId === actor.userId,
    updatedAt: row.updatedAt,
  }
}

export async function listLiabilities(
  actor: Actor,
  options: { includeInactive?: boolean } = {},
): Promise<LiabilityView[]> {
  const rows = await prisma.liability.findMany({
    where: {
      ...visibleTo(actor),
      ...(options.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })

  return rows.map((row) => toView(row, actor))
}

export async function getLiability(actor: Actor, id: string): Promise<LiabilityView> {
  const row = await prisma.liability.findFirst({ where: { id, ...visibleTo(actor) } })
  if (!row) throw new NotFoundError()
  return toView(row, actor)
}

function assertCategoryAllowed(actor: Actor, type: Liability['type']): void {
  const meta = liabilityTypeMeta(type)
  if (meta?.advanced) assertFeature(actor, 'ADVANCED_ASSETS')
}

function assertCurrencyAllowed(actor: Actor, currency: string): void {
  if (currency.toUpperCase() !== actor.defaultCurrency.toUpperCase()) {
    assertFeature(actor, 'MULTI_CURRENCY')
  }
}

function writableData(
  input: LiabilityInputPayload,
  actor: Actor,
): Prisma.LiabilityUncheckedCreateInput {
  return {
    userId: actor.userId,
    householdId: assertCanTagHousehold(actor, input.householdId ?? null),
    type: input.type,
    name: input.name,
    amount: input.amount,
    currency: input.currency,
    dueDate: input.dueDate ?? null,
    deductibleForZakat: input.deductibleForZakat ?? null,
    notes: input.notes ?? null,
  }
}

export async function createLiability(
  actor: Actor,
  input: LiabilityInputPayload,
): Promise<LiabilityView> {
  assertCategoryAllowed(actor, input.type)
  assertCurrencyAllowed(actor, input.currency)

  const activeCount = await prisma.liability.count({
    where: { userId: actor.userId, active: true },
  })
  assertWithinLimit(actor, 'liabilities', activeCount)

  const row = await prisma.liability.create({ data: writableData(input, actor) })

  await recordAudit({
    userId: actor.userId,
    action: 'LIABILITY_CREATED',
    entityType: 'Liability',
    entityId: row.id,
    metadata: { type: row.type, currency: row.currency },
  })

  return toView(row, actor)
}

export async function updateLiability(
  actor: Actor,
  id: string,
  input: LiabilityInputPayload & { active?: boolean },
): Promise<LiabilityView> {
  const existing = await prisma.liability.findUnique({ where: { id } })
  assertOwner(actor, existing)

  assertCategoryAllowed(actor, input.type)
  assertCurrencyAllowed(actor, input.currency)

  const row = await prisma.liability.update({
    where: { id },
    data: { ...writableData(input, actor), active: input.active ?? existing?.active ?? true },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'LIABILITY_UPDATED',
    entityType: 'Liability',
    entityId: row.id,
    metadata: { type: row.type, currency: row.currency },
  })

  return toView(row, actor)
}

export async function deleteLiability(actor: Actor, id: string): Promise<void> {
  const existing = await prisma.liability.findUnique({ where: { id } })
  assertOwner(actor, existing)

  await prisma.liability.update({ where: { id }, data: { active: false } })

  await recordAudit({
    userId: actor.userId,
    action: 'LIABILITY_DELETED',
    entityType: 'Liability',
    entityId: id,
    metadata: { type: existing?.type },
  })
}

export async function liabilityUsage(actor: Actor) {
  const used = await prisma.liability.count({ where: { userId: actor.userId, active: true } })
  return { used, limit: getLimit(actor, 'liabilities') }
}
