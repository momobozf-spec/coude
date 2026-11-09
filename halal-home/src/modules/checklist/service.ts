/**
 * Checklistlogica.
 *
 * De laag tussen route handlers/server actions en de database. Beslissingen die
 * puur zijn (welke template geldt, hoeveel procent) staan in `domain/`; hier
 * staan de acties die meerdere tabellen raken.
 */
import 'server-only'
import { AnalyticsEventType, ChecklistImportance, type ChecklistScope } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { ValidationError } from '@/lib/errors'
import { recordEvent } from '@/modules/analytics/service'
import * as journeyRepository from '@/modules/journey/repository'
import {
  CHECKLIST_DISCLAIMER,
  checklistProgress,
  IMPORTANCE_ORDER,
  type ChecklistProgress,
} from './domain/progress'
import { selectTemplates, type ChecklistContext } from './domain/selection'
import * as repository from './repository'

export interface ChecklistItemView {
  /** Id van de voortgangsrij (`UserChecklistItem`), niet van het template-item. */
  id: string
  /** Stabiele sleutel van het template-item. */
  key: string
  title: string
  description: string | null
  helpText: string | null
  termSlug: string | null
  section: string | null
  importance: ChecklistImportance
  documentCategory: string | null
  completed: boolean
  notApplicable: boolean
  documentId: string | null
  notes: string | null
}

export interface ChecklistSectionView {
  title: string
  items: ChecklistItemView[]
}

export interface ChecklistView {
  templateKey: string
  name: string
  description: string | null
  scope: ChecklistScope
  sections: ChecklistSectionView[]
  progress: ChecklistProgress
  /** Herkomst; de UI toont dit onder de lijst. */
  sourceUrl: string | null
  lastVerifiedAt: Date | null
  version: number
  disclaimer: string
}

/**
 * De checklists van een traject, klaar om te tonen.
 *
 * `stage` beperkt tot één fase (voor de stagepagina); zonder `stage` komt alles
 * terug (voor `/checklists`).
 */
export async function getChecklists(
  userId: string,
  journeyId: string,
  filter?: { stage?: ChecklistContext['stage']; scope?: ChecklistScope },
): Promise<ChecklistView[]> {
  const journey = await journeyRepository.requireJourney(userId, journeyId)

  const templates = await repository.listActiveTemplates(journey.country)
  const context: ChecklistContext = {
    country: journey.country,
    region: journey.region,
    stage: filter?.stage ?? null,
    purchaseType: journey.purchaseType,
    firstHome: journey.firstHome,
    scope: filter?.scope ?? null,
  }

  const applicable = selectTemplates(templates, context)
  if (applicable.length === 0) return []

  // Eén query voor alle voortgang, in plaats van per template. Anders schaalt
  // een overzichtspagina met het aantal checklists.
  const userItems = await repository.listUserItems(userId, journeyId)
  const byItemId = new Map(userItems.map((u) => [u.itemId, u]))

  return applicable.map((template) => {
    const items: ChecklistItemView[] = template.items
      .map((item) => {
        const progress = byItemId.get(item.id)
        return {
          // Zonder voortgangsrij bestaat er nog geen id om op te muteren; de
          // UI toont het item dan als open en initialiseert bij de eerste klik.
          id: progress?.id ?? '',
          key: item.key,
          title: item.title,
          description: item.description,
          helpText: item.helpText,
          termSlug: item.termSlug,
          section: item.section,
          importance: item.importance,
          documentCategory: item.documentCategory,
          completed: progress?.completed ?? false,
          notApplicable: progress?.notApplicable ?? false,
          documentId: progress?.documentId ?? null,
          notes: progress?.notes ?? null,
        }
      })
      .sort(
        (a, b) =>
          IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] ||
          a.title.localeCompare(b.title),
      )

    return {
      templateKey: template.key,
      name: template.name,
      description: template.description,
      scope: template.scope,
      sections: groupBySection(template.items, items),
      progress: checklistProgress(items),
      sourceUrl: template.sourceUrl,
      lastVerifiedAt: template.lastVerifiedAt,
      version: template.version,
      disclaimer: template.disclaimer ?? CHECKLIST_DISCLAIMER,
    }
  })
}

/**
 * Groepeert op sectiekop, in de volgorde waarin de secties in de template
 * staan. Sorteren op alfabet zou "Na akte" vóór "Voor de afspraak" zetten.
 */
function groupBySection(
  templateItems: readonly { key: string; section: string | null }[],
  items: readonly ChecklistItemView[],
): ChecklistSectionView[] {
  const order: string[] = []
  for (const item of templateItems) {
    const section = item.section ?? 'Algemeen'
    if (!order.includes(section)) order.push(section)
  }

  return order
    .map((title) => ({
      title,
      items: items.filter((i) => (i.section ?? 'Algemeen') === title),
    }))
    .filter((section) => section.items.length > 0)
}

/**
 * Zet de voortgangsrijen klaar voor alle toepasselijke checklists.
 *
 * Draait bij het initialiseren van een traject en is idempotent: opnieuw
 * aanroepen voegt alleen items toe die er nog niet waren. Dat is nodig wanneer
 * een gebruiker later van gewest wisselt of een nieuwe template beschikbaar
 * komt.
 */
export async function initializeChecklists(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  options: {
    userId: string
    journeyId: string
    country: string
    region: string | null
    purchaseType: ChecklistContext['purchaseType']
    firstHome: boolean
  },
): Promise<number> {
  const templates = await tx.checklistTemplate.findMany({
    where: { country: options.country, active: true },
    include: { items: { select: { id: true } } },
  })

  const applicable = selectTemplates(templates, {
    country: options.country,
    region: options.region,
    purchaseType: options.purchaseType,
    firstHome: options.firstHome,
  })

  const itemIds = applicable.flatMap((template) => template.items.map((i) => i.id))
  return repository.ensureUserItems(tx, {
    userId: options.userId,
    journeyId: options.journeyId,
    itemIds,
  })
}

export type ChecklistAction = 'complete' | 'reopen' | 'not_applicable'

/**
 * Vinkt een item af, opent het opnieuw, of markeert het als niet van toepassing.
 *
 * Werkt op de sleutel van het template-item en niet op een voortgangs-id, zodat
 * de UI ook een item kan afvinken waarvoor nog geen rij bestaat. De rij wordt
 * dan aangemaakt — met de journey-eigendomscheck ervóór.
 */
export async function setChecklistItemState(
  userId: string,
  journeyId: string,
  itemKey: string,
  action: ChecklistAction,
): Promise<{ completed: boolean; notApplicable: boolean }> {
  // Eigendomscheck op het traject. Zonder deze regel kan een gebruiker met een
  // geraden journeyId de checklist van iemand anders muteren.
  await journeyRepository.requireJourney(userId, journeyId)

  const item = await prisma.checklistItem.findFirst({
    where: { key: itemKey },
    select: { id: true, key: true, importance: true },
  })
  if (!item) throw new ValidationError('Onbekend checklist-item')

  const now = new Date()
  const next = {
    complete: { completed: true, completedAt: now, notApplicable: false },
    reopen: { completed: false, completedAt: null, notApplicable: false },
    not_applicable: { completed: false, completedAt: null, notApplicable: true },
  }[action]

  await prisma.userChecklistItem.upsert({
    where: { journeyId_itemId: { journeyId, itemId: item.id } },
    create: { userId, journeyId, itemId: item.id, ...next },
    update: next,
  })

  await recordEvent({
    userId,
    type:
      action === 'complete'
        ? AnalyticsEventType.CHECKLIST_ITEM_COMPLETED
        : AnalyticsEventType.CHECKLIST_ITEM_REOPENED,
    entityKey: item.key,
    properties: { source: action },
  })

  return { completed: next.completed, notApplicable: next.notApplicable }
}

/**
 * Koppelt een document aan een checklist-item en vinkt het af.
 *
 * Voorbereid op fase 5: zodra de documentkluis er is, roept de upload-flow deze
 * functie aan. De eigendomscheck op zowel het traject als het document staat er
 * nu al, zodat die niet vergeten wordt wanneer de rest volgt.
 */
export async function attachDocumentToItem(
  userId: string,
  journeyId: string,
  itemKey: string,
  documentId: string,
): Promise<void> {
  await journeyRepository.requireJourney(userId, journeyId)

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  })
  if (!document) throw new ValidationError('Document niet gevonden')

  const item = await prisma.checklistItem.findFirst({
    where: { key: itemKey },
    select: { id: true },
  })
  if (!item) throw new ValidationError('Onbekend checklist-item')

  await prisma.userChecklistItem.upsert({
    where: { journeyId_itemId: { journeyId, itemId: item.id } },
    create: {
      userId,
      journeyId,
      itemId: item.id,
      documentId,
      completed: true,
      completedAt: new Date(),
    },
    update: { documentId, completed: true, completedAt: new Date() },
  })
}

export { CHECKLIST_DISCLAIMER }
