/**
 * Alles wat het dashboard toont, in één query-set.
 *
 * Bewust hier en niet in de pagina: een React-component die zelf Prisma
 * aanroept is een component die je niet kan testen zonder database, en waarin de
 * `userId`-filter ooit ontbreekt. De pagina krijgt een kant-en-klaar object.
 */
import 'server-only'
import { DocumentStatus, JourneyStage, TaskStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { progressByStage, type StageTaskProgressInput } from './domain/progress'
import { buildRecommendations, type Recommendation } from './domain/recommendations'
import { buildStageViews, type StageView } from './domain/stageState'
import { STAGE_META, STAGE_ORDER, stageIndex } from './domain/stages'
import { buildRecommendationContext } from './views'
import { getFinancingContext, getFinancingEvidence } from '@/modules/financing/service'
import type { FinancingNeed } from '@/modules/financing/domain/need'
import * as repository from './repository'

export interface DashboardData {
  journey: {
    id: string
    name: string
    currentStage: JourneyStage
    stageLabel: string
    stageFocus: string
    stagePosition: number
    totalStages: number
    progress: number
    targetBudgetCents: number | null
    ownContributionCents: number | null
    timeline: StageView[]
  } | null

  /**
   * De financieringsstand: wat er nodig is en wat de gebruiker al deed.
   * Null wanneer er geen traject is.
   */
  financing: {
    need: FinancingNeed
    quoteCount: number
    productsCompared: number
  } | null

  /** De ene stap die bovenaan staat. Dezelfde bron als de lijst hieronder. */
  nextAction: Recommendation | null
  recommendations: Recommendation[]

  upcoming: {
    id: string
    title: string
    moment: Date
    type: string
  }[]

  counts: {
    savedProperties: number
    activeSearches: number
    documents: number
    openTasks: number
    completedTasks: number
    missingChecklistItems: number
    unreadNotifications: number
  }
}

/**
 * Het dashboard voor het actieve traject van deze gebruiker.
 *
 * Zonder traject geeft dit `journey: null` terug in plaats van te gooien: een
 * nieuwe gebruiker hoort een uitnodiging te zien, geen foutpagina.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const journey = await repository.findActiveJourney(userId)

  const [savedProperties, activeSearches, documents, unreadNotifications] = await Promise.all([
    prisma.savedProperty.count({ where: { userId } }),
    prisma.propertySearch.count({ where: { userId, active: true } }),
    prisma.document.count({ where: { userId, status: { not: DocumentStatus.DELETED } } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  if (!journey) {
    return {
      journey: null,
      financing: null,
      nextAction: null,
      recommendations: [],
      upcoming: [],
      counts: {
        savedProperties,
        activeSearches,
        documents,
        openTasks: 0,
        completedTasks: 0,
        missingChecklistItems: 0,
        unreadNotifications,
      },
    }
  }

  const [tasks, events, missingChecklistItems, financingContext, financingEvidence] =
    await Promise.all([
    prisma.journeyTask.findMany({
      where: { journeyId: journey.id, userId },
      select: { stage: true, status: true, optional: true },
    }),
    repository.listUpcomingEvents(userId, { limit: 5 }),
    prisma.userChecklistItem.count({
      where: {
        userId,
        journeyId: journey.id,
        completed: false,
        notApplicable: false,
        item: { importance: 'REQUIRED' },
      },
    }),
    getFinancingContext(userId),
    getFinancingEvidence(userId, journey.id),
  ])

  const stageProgress = progressByStage(tasks as StageTaskProgressInput[])
  const meta = STAGE_META[journey.currentStage]

  // Eén bron voor "wat moet ik nu doen": de eerste aanbeveling is de volgende
  // stap. Twee losse berekeningen zouden uit de pas kunnen lopen.
  const recommendations = buildRecommendations(
    await buildRecommendationContext(userId, journey.id),
  )

  return {
    journey: {
      id: journey.id,
      name: journey.name,
      currentStage: journey.currentStage,
      stageLabel: meta.label,
      stageFocus: meta.focus,
      stagePosition: stageIndex(journey.currentStage) + 1,
      totalStages: STAGE_ORDER.length,
      progress: journey.progressPercentage,
      targetBudgetCents: journey.targetBudgetCents,
      ownContributionCents: journey.ownContributionCents,
      timeline: buildStageViews(journey.currentStage, stageProgress),
    },
    financing: {
      need: financingContext.need,
      quoteCount: financingEvidence.quoteCount,
      productsCompared: financingEvidence.distinctProductsCompared,
    },
    nextAction: recommendations[0] ?? null,
    recommendations,
    upcoming: events
      .map((event) => ({
        id: event.id,
        title: event.title,
        moment: (event.startsAt ?? event.dueAt) as Date,
        type: event.type,
      }))
      .filter((e) => e.moment !== null),
    counts: {
      savedProperties,
      activeSearches,
      documents,
      openTasks: tasks.filter(
        (t) => t.status === TaskStatus.TODO || t.status === TaskStatus.IN_PROGRESS,
      ).length,
      completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      missingChecklistItems,
      unreadNotifications,
    },
  }
}
