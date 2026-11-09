/**
 * Trajectlogica: de laag tussen route handlers/server actions en de database.
 *
 * Hier staan de acties die meerdere tabellen raken. De pure beslissingen — "mag
 * deze overgang", "hoeveel procent", "wat is geblokkeerd" — staan in `domain/`
 * en zijn zonder database testbaar.
 *
 * REGEL: React wijzigt nooit zelf een fase. Alleen `evaluateJourneyStage` en
 * `changeStage` verplaatsen een traject, en beide gaan door de domeinlogica.
 */
import 'server-only'
import {
  AnalyticsEventType,
  JourneyStage,
  JourneyStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { ConflictError, ValidationError } from '@/lib/errors'
import { recordAudit } from '@/modules/audit/service'
import { recordEvent } from '@/modules/analytics/service'
import { initializeChecklists } from '@/modules/checklist/service'
import {
  allDependencyKeys,
  blueprintTasksFor,
  CURRENT_BLUEPRINT_VERSION,
  dependenciesOf,
  type BlueprintTask,
} from './domain/blueprint'
import { hasCycle, type DependencyNode } from './domain/dependencies'
import {
  calculateProgress,
  progressByStage,
  type StageTaskProgressInput,
} from './domain/progress'
import { canAdvanceStage, stagesBefore } from './domain/stageState'
import { assertTransition, canTransition, stageIndex } from './domain/stages'
import * as repository from './repository'

type TransactionClient = Prisma.TransactionClient

export interface CreateJourneyInput {
  name: string
  country?: string
  region?: string | null
  targetBudgetCents?: number | null
  ownContributionCents?: number | null
  needsFinancing?: boolean | null
  targetLocation?: string | null
  targetPostalCode?: string | null
  searchRadiusKm?: number | null
  purchaseType?: Prisma.HomeBuyingJourneyCreateInput['purchaseType']
  timeline?: Prisma.HomeBuyingJourneyCreateInput['timeline']
  targetDate?: Date | null
  firstHome?: boolean
  /** De fase waarin het traject start. Volgt uit het onboarding-doel. */
  startStage?: JourneyStage
}

/**
 * Maakt een traject aan en zet meteen alles klaar: blauwdruktaken,
 * afhankelijkheden en checklists.
 *
 * ─── IDEMPOTENT ──────────────────────────────────────────────────────────────
 *
 * Twee keer op "afronden" klikken mag geen 88 taken opleveren. Drie
 * mechanismen samen garanderen dat:
 *
 *   1. de unique constraint op (userId, name) — een tweede traject met dezelfde
 *      naam bestaat niet;
 *   2. `initializedAt` — is die gezet, dan slaan we het opzetten over;
 *   3. de unique constraint op (journeyId, templateKey) — zelfs bij een race
 *      maakt de tweede insert geen duplicaat.
 *
 * Alles in één transactie: een traject met halve taken is erger dan geen
 * traject, want de gebruiker ziet dan een lijst die stilzwijgend incompleet is.
 */
export async function createJourneyWithBlueprint(
  userId: string,
  input: CreateJourneyInput,
) {
  const country = input.country ?? 'BE'
  const firstHome = input.firstHome ?? true
  const startStage = input.startStage ?? JourneyStage.ORIENTATION

  // Bestaat er al een traject met deze naam? Dan is dit een dubbele submit.
  const existing = await prisma.homeBuyingJourney.findFirst({
    where: { userId, name: input.name },
    select: { id: true, initializedAt: true },
  })

  if (existing?.initializedAt) {
    return repository.requireJourney(userId, existing.id)
  }

  const journey = await prisma.$transaction(async (tx) => {
    const created = existing
      ? await tx.homeBuyingJourney.update({
          where: { id: existing.id },
          data: { currentStage: startStage },
        })
      : await tx.homeBuyingJourney.create({
          data: {
            userId,
            name: input.name,
            country,
            firstHome,
            currentStage: startStage,
            region: input.region ?? null,
            targetBudgetCents: input.targetBudgetCents ?? null,
            ownContributionCents: input.ownContributionCents ?? null,
            needsFinancing: input.needsFinancing ?? null,
            targetLocation: input.targetLocation ?? null,
            targetPostalCode: input.targetPostalCode ?? null,
            searchRadiusKm: input.searchRadiusKm ?? null,
            purchaseType: input.purchaseType,
            timeline: input.timeline,
            targetDate: input.targetDate ?? null,
            blueprintVersion: CURRENT_BLUEPRINT_VERSION,
          },
        })

    await applyBlueprintWithin(tx, {
      userId,
      journeyId: created.id,
      country,
      firstHome,
      version: created.blueprintVersion,
      startStage,
    })

    await initializeChecklists(tx, {
      userId,
      journeyId: created.id,
      country,
      region: created.region,
      purchaseType: created.purchaseType,
      firstHome,
    })

    // Pas hier: vanaf nu geldt het traject als opgezet.
    return tx.homeBuyingJourney.update({
      where: { id: created.id },
      data: { initializedAt: new Date() },
    })
  })

  const progress = await recalculateProgress(userId, journey.id)

  await recordAudit({
    userId,
    action: 'JOURNEY_CREATED',
    entityType: 'HomeBuyingJourney',
    entityId: journey.id,
    metadata: { country, firstHome, blueprintVersion: journey.blueprintVersion },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.JOURNEY_CREATED,
    stage: startStage,
    properties: {
      blueprintVersion: journey.blueprintVersion,
      country,
      progressPercentage: progress,
      hasBudget: journey.targetBudgetCents !== null,
      hasOwnContribution: journey.ownContributionCents !== null,
    },
  })

  return journey
}

/**
 * Zet de blauwdruktaken klaar, inclusief hun onderlinge afhankelijkheden.
 *
 * Gematcht op `templateKey`, dus opnieuw toepassen na het toevoegen van een
 * nieuwe blauwdruktaak levert geen duplicaten op bij gebruikers die al bezig
 * zijn.
 *
 * Taken uit fasen vóór `startStage` krijgen SKIPPED in plaats van weggelaten te
 * worden: wie aangeeft al een woning gevonden te hebben, moet nog steeds kunnen
 * terugbladeren en alsnog iets afvinken. Weglaten gooit die mogelijkheid
 * permanent weg.
 */
async function applyBlueprintWithin(
  tx: TransactionClient,
  options: {
    userId: string
    journeyId: string
    country: string
    firstHome: boolean
    version: number
    startStage: JourneyStage
  },
): Promise<void> {
  const blueprint = blueprintTasksFor({
    country: options.country,
    firstHome: options.firstHome,
    version: options.version,
  })

  assertBlueprintIsSound(blueprint)

  const skippedStages = new Set(stagesBefore(options.startStage))

  const existing = await tx.journeyTask.findMany({
    where: { journeyId: options.journeyId },
    select: { id: true, templateKey: true },
  })
  const idByKey = new Map(
    existing.filter((t) => t.templateKey).map((t) => [t.templateKey as string, t.id]),
  )

  // Stap 1: de taken. Zonder rijen kunnen we geen afhankelijkheden leggen.
  for (const [index, task] of blueprint.entries()) {
    if (idByKey.has(task.key)) continue

    const preSkipped = skippedStages.has(task.stage)

    const created = await tx.journeyTask.create({
      data: {
        journeyId: options.journeyId,
        userId: options.userId,
        stage: task.stage,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority ?? 'NORMAL',
        optional: task.optional ?? false,
        // Sprongen van 10 laten ruimte om later een taak ertussen te schuiven
        // zonder alles te hernummeren.
        sortOrder: index * 10,
        templateKey: task.key,
        system: true,
        status: preSkipped ? TaskStatus.SKIPPED : TaskStatus.TODO,
      },
      select: { id: true },
    })
    idByKey.set(task.key, created.id)
  }

  // Stap 2: de afhankelijkheden.
  for (const task of blueprint) {
    const taskId = idByKey.get(task.key)
    const dependencies = dependenciesOf(task)
    if (!taskId || dependencies.length === 0) continue

    for (const { dependsOnKey, type } of dependencies) {
      const dependsOnId = idByKey.get(dependsOnKey)
      if (!dependsOnId) continue

      await tx.taskDependency.upsert({
        where: { taskId_dependsOnId: { taskId, dependsOnId } },
        create: { taskId, dependsOnId, type },
        update: { type },
      })
    }
  }
}

/**
 * Controleert de blauwdruk vóór we hem uitrollen.
 *
 * Een cyclus zou elke betrokken taak permanent blokkeren, en een verwijzing
 * naar een niet-bestaande sleutel zou stil genegeerd worden. Beide vallen pas
 * maanden later op, bij een gebruiker die vastloopt — dus hier hard falen.
 */
function assertBlueprintIsSound(tasks: readonly BlueprintTask[]): void {
  const keys = new Set(tasks.map((t) => t.key))

  for (const task of tasks) {
    for (const dependency of allDependencyKeys(task)) {
      if (!keys.has(dependency)) {
        throw new Error(
          `Blauwdruk is kapot: taak ${task.key} hangt af van onbekende sleutel ${dependency}.`,
        )
      }
    }
  }

  const nodes: DependencyNode[] = tasks.map((task) => ({
    id: task.key,
    title: task.title,
    status: TaskStatus.TODO,
    dependsOn: allDependencyKeys(task),
  }))

  if (hasCycle(nodes)) {
    throw new Error('Blauwdruk is kapot: er zit een cyclus in de afhankelijkheden.')
  }
}

/**
 * Herberekent de voortgang en slaat hem op.
 *
 * Gedenormaliseerd omdat het dashboard anders voor elk traject alle taken zou
 * moeten tellen. Wordt aangeroepen na elke wijziging die de voortgang raakt.
 */
export async function recalculateProgress(userId: string, journeyId: string): Promise<number> {
  const journey = await repository.requireJourney(userId, journeyId)
  const tasks = await prisma.journeyTask.findMany({
    where: { journeyId, userId },
    select: { status: true, optional: true },
  })

  const progress = calculateProgress(journey.currentStage, tasks)

  await prisma.homeBuyingJourney.updateMany({
    where: { id: journeyId, userId },
    data: { progressPercentage: progress },
  })

  return progress
}

/**
 * Verplaatst een traject naar een andere fase.
 *
 * De regel ("vooruit één stap, terug altijd") staat in `domain/stages.ts`; hier
 * wordt hij toegepast en het gevolg vastgelegd.
 */
export async function changeStage(userId: string, journeyId: string, to: JourneyStage) {
  const journey = await repository.requireJourney(userId, journeyId)

  if (!canTransition(journey.currentStage, to)) {
    assertTransition(journey.currentStage, to) // gooit met een leesbare reden
  }

  const completed = to === JourneyStage.COMPLETED

  await prisma.homeBuyingJourney.updateMany({
    where: { id: journeyId, userId },
    data: {
      currentStage: to,
      ...(completed ? { status: JourneyStatus.COMPLETED, completedAt: new Date() } : {}),
    },
  })

  const progress = await recalculateProgress(userId, journeyId)

  await recordAudit({
    userId,
    action: 'JOURNEY_STAGE_CHANGED',
    entityType: 'HomeBuyingJourney',
    entityId: journeyId,
    metadata: { from: journey.currentStage, to, progress },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.STAGE_COMPLETED,
    stage: journey.currentStage,
    properties: {
      fromStage: journey.currentStage,
      toStage: to,
      progressPercentage: progress,
    },
  })

  return { stage: to, progress }
}

export interface StageEvaluation {
  journeyId: string
  currentStage: JourneyStage
  advanced: boolean
  previousStage: JourneyStage | null
  progress: number
  reason: string | null
}

/**
 * De centrale functie: staat dit traject klaar voor de volgende fase?
 *
 * Wordt aangeroepen na elke taakwijziging. Wanneer alle VERPLICHTE taken van de
 * huidige fase afgehandeld zijn, schuift het traject door en wordt de volgende
 * fase actief.
 *
 * Bewust maar één fase per aanroep: twee fasen tegelijk overslaan zou betekenen
 * dat de gebruiker een fase nooit gezien heeft. Wie in één klap klaar is met
 * meerdere fasen (bijvoorbeeld doordat alles overgeslagen werd), schuift op bij
 * de volgende evaluatie.
 */
export async function evaluateJourneyStage(
  userId: string,
  journeyId: string,
): Promise<StageEvaluation> {
  const journey = await repository.requireJourney(userId, journeyId)

  const tasks = await prisma.journeyTask.findMany({
    where: { journeyId, userId },
    select: { stage: true, status: true, optional: true },
  })

  const stageProgress = progressByStage(tasks as StageTaskProgressInput[])
  const check = canAdvanceStage(journey.currentStage, stageProgress)

  // Een fase zonder enkele taak schuift niet vanzelf door: dan zou een traject
  // bij het aanmaken meteen naar het einde schieten.
  const currentHasTasks =
    stageProgress.find((p) => p.stage === journey.currentStage)?.breakdown.total ?? 0

  if (!check.canAdvance || check.nextStage === null || currentHasTasks === 0) {
    const progress = await recalculateProgress(userId, journeyId)
    return {
      journeyId,
      currentStage: journey.currentStage,
      advanced: false,
      previousStage: null,
      progress,
      reason: currentHasTasks === 0 ? 'Deze fase heeft geen taken.' : check.reason,
    }
  }

  const result = await changeStage(userId, journeyId, check.nextStage)

  await recordEvent({
    userId,
    type: AnalyticsEventType.STAGE_OPENED,
    stage: check.nextStage,
    properties: { fromStage: journey.currentStage, stageIndex: stageIndex(check.nextStage) },
  })

  return {
    journeyId,
    currentStage: result.stage,
    advanced: true,
    previousStage: journey.currentStage,
    progress: result.progress,
    reason: null,
  }
}

export interface TaskMutationResult {
  taskId: string
  status: TaskStatus
  progress: number
  /** Taken die door deze wijziging beschikbaar zijn geworden. */
  unlockedTaskIds: string[]
  stage: StageEvaluation
}

/**
 * Zet de status van een taak en verwerkt alle gevolgen.
 *
 * De volledige keten, in volgorde:
 *   1. eigendom controleren;
 *   2. afhankelijkheden controleren (bij voltooien);
 *   3. status en `completedAt` zetten;
 *   4. bepalen welke taken hierdoor vrijkomen;
 *   5. voortgang herberekenen;
 *   6. fase-overgang evalueren;
 *   7. analytics vastleggen.
 *
 * Stap 1 tot en met 3 zitten in één transactie. De rest bewust niet: dat zijn
 * afgeleide berekeningen, en een mislukte analytics-insert mag geen afgevinkte
 * taak terugdraaien.
 */
export async function setTaskStatus(
  userId: string,
  taskId: string,
  status: TaskStatus,
): Promise<TaskMutationResult> {
  const before = await prisma.journeyTask.findFirst({
    where: { id: taskId, userId },
    include: { dependencies: { select: { dependsOnId: true, type: true } } },
  })
  if (!before) throw new ValidationError('Taak niet gevonden')

  if (status === TaskStatus.SKIPPED && !before.optional && before.system) {
    throw new ValidationError(
      'Deze taak is verplicht en kan niet overgeslagen worden. ' +
        'Markeer hem als voltooid wanneer je hem geregeld hebt.',
    )
  }

  await prisma.$transaction(async (tx) => {
    // Alleen BLOCKING houdt tegen. Een adviserende volgorde bepaalt de
    // weergave; hij mag niet verhinderen dat werk dat aantoonbaar gedaan is
    // ook als gedaan geregistreerd wordt.
    const blocking = before.dependencies.filter((d) => d.type === 'BLOCKING')

    if (status === TaskStatus.COMPLETED && blocking.length > 0) {
      const blockers = await tx.journeyTask.findMany({
        where: {
          id: { in: blocking.map((d) => d.dependsOnId) },
          userId,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.SKIPPED] },
        },
        select: { title: true },
      })

      if (blockers.length > 0) {
        throw new ConflictError(
          `Deze taak wacht nog op: ${blockers.map((b) => b.title).join(', ')}.`,
        )
      }
    }

    const result = await tx.journeyTask.updateMany({
      where: { id: taskId, userId },
      data: {
        status,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
    })
    if (result.count === 0) throw new ValidationError('Taak niet gevonden')
  })

  const unlockedTaskIds =
    status === TaskStatus.COMPLETED || status === TaskStatus.SKIPPED
      ? await findNewlyUnlocked(userId, taskId)
      : []

  await recalculateProgress(userId, before.journeyId)
  const stage = await evaluateJourneyStage(userId, before.journeyId)

  await recordEvent({
    userId,
    type:
      status === TaskStatus.COMPLETED
        ? AnalyticsEventType.TASK_COMPLETED
        : status === TaskStatus.SKIPPED
          ? AnalyticsEventType.TASK_SKIPPED
          : AnalyticsEventType.TASK_REOPENED,
    stage: before.stage,
    entityKey: before.templateKey,
    properties: {
      wasOptional: before.optional,
      progressPercentage: stage.progress,
    },
  })

  return { taskId, status, progress: stage.progress, unlockedTaskIds, stage }
}

/**
 * Welke taken zijn door het afronden van `taskId` vrijgekomen?
 *
 * Een taak komt vrij wanneer al haar afhankelijkheden afgehandeld zijn. We
 * kijken alleen naar de directe afhankelijken van de zojuist afgeronde taak —
 * verderop in de keten verandert er niets zolang die taken zelf nog wachten.
 */
async function findNewlyUnlocked(userId: string, taskId: string): Promise<string[]> {
  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnId: taskId },
    select: {
      taskId: true,
      task: {
        select: {
          id: true,
          userId: true,
          status: true,
          dependencies: {
            select: { type: true, dependsOn: { select: { status: true } } },
          },
        },
      },
    },
  })

  return dependents
    .filter((d) => d.task.userId === userId)
    .filter((d) => d.task.status === TaskStatus.TODO || d.task.status === TaskStatus.IN_PROGRESS)
    .filter((d) =>
      d.task.dependencies
        .filter((dep) => dep.type === 'BLOCKING')
        .every(
          (dep) =>
            dep.dependsOn.status === TaskStatus.COMPLETED ||
            dep.dependsOn.status === TaskStatus.SKIPPED,
        ),
    )
    .map((d) => d.taskId)
}

/** Kortere vorm voor het meest voorkomende geval. */
export function completeTask(userId: string, taskId: string): Promise<TaskMutationResult> {
  return setTaskStatus(userId, taskId, TaskStatus.COMPLETED)
}

export function reopenTask(userId: string, taskId: string): Promise<TaskMutationResult> {
  return setTaskStatus(userId, taskId, TaskStatus.TODO)
}
