/**
 * Data-toegang voor checklists.
 *
 * Zelfde regel als overal: elke functie die gebruikersdata raakt neemt `userId`
 * als eerste argument en gebruikt hem in de WHERE-clausule. Templates en items
 * zijn redactionele inhoud en dus niet per gebruiker — de voortgang
 * (`UserChecklistItem`) wél.
 */
import 'server-only'
import type { ChecklistScope, Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { NotFoundError } from '@/lib/errors'

export type TemplateWithItems = Prisma.ChecklistTemplateGetPayload<{
  include: { items: true }
}>

/** Alle actieve templates. De selectie zelf gebeurt in het domein. */
export async function listActiveTemplates(country: string): Promise<TemplateWithItems[]> {
  return prisma.checklistTemplate.findMany({
    where: { country, active: true },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function findTemplateByKey(key: string): Promise<TemplateWithItems | null> {
  return prisma.checklistTemplate.findUnique({
    where: { key },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
}

/** De voortgang van deze gebruiker binnen dit traject. */
export async function listUserItems(userId: string, journeyId: string) {
  return prisma.userChecklistItem.findMany({
    where: { userId, journeyId },
    include: {
      item: { include: { template: { select: { key: true, name: true, scope: true } } } },
    },
  })
}

/**
 * Eén voortgangsrij, met eigendomscheck.
 *
 * `findFirst` met userId en niet `findUnique` op id: zie de kop van
 * src/modules/journey/repository.ts.
 */
export async function findUserItem(userId: string, userItemId: string) {
  return prisma.userChecklistItem.findFirst({
    where: { id: userItemId, userId },
    include: { item: true },
  })
}

export async function requireUserItem(userId: string, userItemId: string) {
  const item = await findUserItem(userId, userItemId)
  // NotFound en niet Forbidden: wie geen toegang heeft, hoort niet te kunnen
  // afleiden dát de rij bestaat.
  if (!item) throw new NotFoundError('Checklist-item niet gevonden')
  return item
}

export interface UserItemUpdate {
  completed?: boolean
  completedAt?: Date | null
  notApplicable?: boolean
  notes?: string | null
  documentId?: string | null
}

export async function updateUserItem(
  userId: string,
  userItemId: string,
  data: UserItemUpdate,
): Promise<void> {
  const result = await prisma.userChecklistItem.updateMany({
    where: { id: userItemId, userId },
    data,
  })
  if (result.count === 0) throw new NotFoundError('Checklist-item niet gevonden')
}

/**
 * Zet de voortgangsrijen klaar voor een traject.
 *
 * Idempotent via `createMany({ skipDuplicates })` op de unique constraint
 * (journeyId, itemId): twee keer initialiseren levert geen duplicaten op en
 * gooit geen constraint-fout.
 */
export async function ensureUserItems(
  tx: Prisma.TransactionClient,
  options: { userId: string; journeyId: string; itemIds: readonly string[] },
): Promise<number> {
  if (options.itemIds.length === 0) return 0

  const result = await tx.userChecklistItem.createMany({
    data: options.itemIds.map((itemId) => ({
      userId: options.userId,
      journeyId: options.journeyId,
      itemId,
    })),
    skipDuplicates: true,
  })

  return result.count
}

/** Aantal openstaande verplichte items, voor het dashboard. */
export async function countOpenRequired(
  userId: string,
  journeyId: string,
  scope?: ChecklistScope,
): Promise<number> {
  return prisma.userChecklistItem.count({
    where: {
      userId,
      journeyId,
      completed: false,
      notApplicable: false,
      item: {
        importance: 'REQUIRED',
        ...(scope ? { template: { scope } } : {}),
      },
    },
  })
}
