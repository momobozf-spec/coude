/**
 * Alles wat de journey-schermen tonen, samengesteld op de server.
 *
 * React-componenten krijgen kant-en-klare objecten. Ze berekenen zelf geen
 * voortgang, bepalen zelf niet wat vergrendeld is, en raken Prisma niet aan —
 * dat is de reden dat de domeinlogica testbaar blijft en dat client en server
 * niet uit elkaar kunnen lopen.
 */
import 'server-only'
import { DocumentStatus, JourneyStage, TaskStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { NotFoundError } from '@/lib/errors'
import { findBlockedTasks } from './domain/dependencies'
import {
  explainProgress,
  progressByStage,
  stageProgressFor,
  type ProgressExplanation,
  type StageProgress,
  type StageTaskProgressInput,
} from './domain/progress'
import {
  buildRecommendations,
  nextBestAction,
  type Recommendation,
  type RecommendationContext,
} from './domain/recommendations'
import { buildStageViews, canAdvanceStage, type StageView } from './domain/stageState'
import { STAGE_META, STAGE_ORDER, stageIndex } from './domain/stages'
import { blueprintTasksFor } from './domain/blueprint'
import * as repository from './repository'

export interface TaskView {
  id: string
  templateKey: string | null
  stage: JourneyStage
  title: string
  description: string | null
  status: TaskStatus
  priority: string
  optional: boolean
  system: boolean
  dueDate: Date | null
  completedAt: Date | null
  /** Waar deze taak heen leidt; komt uit de blauwdruk. */
  href: string | null
  blocked: boolean
  /** Titels van de taken die deze taak tegenhouden. */
  blockedBy: string[]
}

export interface JourneyOverview {
  id: string
  name: string
  currentStage: JourneyStage
  stageLabel: string
  stageFocus: string
  stageDescription: string
  /** "Fase 3 van 11" — 1-gebaseerd. */
  stagePosition: number
  totalStages: number
  progress: number
  progressExplanation: ProgressExplanation
  targetBudgetCents: number | null
  ownContributionCents: number | null
  targetLocation: string | null
  blueprintVersion: number
  timeline: StageView[]
  canAdvance: boolean
  advanceReason: string | null
}

/** Alles wat de taken en tijdlijn nodig hebben, in één keer opgehaald. */
async function loadJourneyData(userId: string, journeyId: string) {
  const journey = await repository.findJourney(userId, journeyId)
  if (!journey) throw new NotFoundError('Traject niet gevonden')

  const tasks = await prisma.journeyTask.findMany({
    where: { journeyId, userId },
    include: { dependencies: { select: { dependsOnId: true, type: true } } },
    orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
  })

  return { journey, tasks }
}

type LoadedTasks = Awaited<ReturnType<typeof loadJourneyData>>['tasks']

/** Zet taken om in weergavemodellen, inclusief blokkering. */
function toTaskViews(tasks: LoadedTasks, country: string, blueprintVersion: number): TaskView[] {
  const nodes = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    // Alleen blokkerende afhankelijkheden maken een taak onklikbaar; een
    // adviserende volgorde bepaalt alleen waar hij in de lijst staat.
    dependsOn: task.dependencies
      .filter((d) => d.type === 'BLOCKING')
      .map((d) => d.dependsOnId),
  }))

  const blocked = new Map(findBlockedTasks(nodes).map((b) => [b.id, b.blockedBy]))

  // De `href` staat in de blauwdruk, niet in de database: het is presentatie,
  // en een route die verandert mag geen migratie zijn.
  const blueprint = new Map(
    blueprintTasksFor({ country, firstHome: true, version: blueprintVersion }).map((t) => [
      t.key,
      t,
    ]),
  )

  return tasks.map((task) => ({
    id: task.id,
    templateKey: task.templateKey,
    stage: task.stage,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    optional: task.optional,
    system: task.system,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    href: task.templateKey ? (blueprint.get(task.templateKey)?.href ?? null) : null,
    blocked: blocked.has(task.id),
    blockedBy: (blocked.get(task.id) ?? []).map((b) => b.title),
  }))
}

/** Het overzicht: tijdlijn, voortgang, huidige fase. */
export async function getJourneyOverview(
  userId: string,
  journeyId: string,
): Promise<JourneyOverview> {
  const { journey, tasks } = await loadJourneyData(userId, journeyId)

  const progressInput: StageTaskProgressInput[] = tasks.map((t) => ({
    stage: t.stage,
    status: t.status,
    optional: t.optional,
  }))

  const stageProgress = progressByStage(progressInput)
  const advance = canAdvanceStage(journey.currentStage, stageProgress)
  const meta = STAGE_META[journey.currentStage]

  return {
    id: journey.id,
    name: journey.name,
    currentStage: journey.currentStage,
    stageLabel: meta.label,
    stageFocus: meta.focus,
    stageDescription: meta.description,
    stagePosition: stageIndex(journey.currentStage) + 1,
    totalStages: STAGE_ORDER.length,
    progress: journey.progressPercentage,
    progressExplanation: explainProgress(journey.currentStage, progressInput),
    targetBudgetCents: journey.targetBudgetCents,
    ownContributionCents: journey.ownContributionCents,
    targetLocation: journey.targetLocation,
    blueprintVersion: journey.blueprintVersion,
    timeline: buildStageViews(journey.currentStage, stageProgress),
    canAdvance: advance.canAdvance,
    advanceReason: advance.reason,
  }
}

export interface StageDetail {
  journeyId: string
  stage: JourneyStage
  label: string
  description: string
  focus: string
  /** Waarom deze fase ertoe doet. Redactionele tekst per fase. */
  importance: string
  position: number
  totalStages: number
  state: StageView['state']
  lockReason: string | null
  progress: StageProgress
  tasks: TaskView[]
  nextAction: Recommendation | null
  /** Handige gereedschappen bij deze fase. */
  tools: { label: string; description: string; href: string }[]
}

/**
 * Waarom is deze fase belangrijk?
 *
 * Redactionele tekst, geen AI. Dit is het antwoord op "waarom moet ik dit
 * doen", en dat mag geen gegenereerde tekst zijn die per keer verschilt.
 */
const STAGE_IMPORTANCE: Record<JourneyStage, string> = {
  ORIENTATION:
    'Wat je hier vastlegt bepaalt alles daarna: waar je zoekt, wat je zoekt en wat je buurt moet bieden. Een half uur nu bespaart weken later.',
  BUDGET:
    'De aankoopprijs is niet wat je betaalt. Registratierechten en notariskosten komen erbovenop, en die moet je uit eigen middelen betalen. Wie dat pas bij de notaris ontdekt, staat voor een probleem.',
  FINANCING:
    'Verkopers vragen steeds vaker een financieringsbewijs vóór ze een bod aannemen. Wie hier klaar is, kan snel schakelen wanneer de juiste woning voorbijkomt.',
  PROPERTY_SEARCH:
    'Goede woningen zijn snel weg. Een opgeslagen zoekopdracht met meldingen zorgt dat je ze ziet op de dag dat ze verschijnen, niet een week later.',
  VIEWINGS:
    'Een bezichtiging is je enige kans om te zien wat foto’s niet tonen: vocht, geluid, buren, lichtinval. Neem een checklist mee en vraag de attesten op.',
  OFFER:
    'Een bod is bindend zodra het aanvaard wordt. De opschortende voorwaarde is je enige uitweg als je financiering niet rondkomt — laat die nooit weg.',
  AGREEMENT:
    'Het compromis bindt je al vóór de notariële akte. Wat je hier tekent, ligt vast; laat onduidelijke clausules uitleggen voor je je handtekening zet.',
  NOTARY:
    'De notaris kan de akte pas voorbereiden met alle attesten. Ontbreekt er één, dan schuift de datum op — en met een verhuis die al gepland staat is dat duur.',
  INSURANCE_ADMIN:
    'Je brandverzekering moet lopen vanaf de dag van de akte. Tussen de akte en je eerste polisdag ben je onverzekerd eigenaar.',
  MOVING:
    'De meterstanden op de dag van de sleuteloverdracht zijn je bewijs. Zonder foto betaal je het verbruik van de vorige bewoner.',
  COMPLETED: 'Je traject is afgerond. Baraka fik met je nieuwe woning.',
}

/** Gereedschappen per fase. Data, zodat een nieuw scherm hier één regel is. */
const STAGE_TOOLS: Partial<
  Record<JourneyStage, { label: string; description: string; href: string }[]>
> = {
  BUDGET: [
    {
      label: 'Kostenraming',
      description: 'Registratierechten en notariskosten voor jouw gewest.',
      href: '/financing/costs',
    },
  ],
  FINANCING: [
    {
      label: 'Financiering vergelijken',
      description: 'Constructies naast elkaar, met bron en verificatiedatum.',
      href: '/financing',
    },
    {
      label: 'Documentenkluis',
      description: 'Verzamel wat elke aanbieder van je vraagt.',
      href: '/documents',
    },
  ],
  PROPERTY_SEARCH: [
    {
      label: 'Zoekopdracht maken',
      description: 'Beschrijf in gewone taal wat je zoekt.',
      href: '/search/new',
    },
  ],
  NOTARY: [
    {
      label: 'Notarischecklist',
      description: 'Alles wat de notaris nodig heeft, per onderdeel.',
      href: '/checklists',
    },
  ],
  MOVING: [
    {
      label: 'Verhuischecklist',
      description: 'Voor, tijdens en na de verhuis.',
      href: '/checklists',
    },
  ],
}

export async function getStageDetail(
  userId: string,
  journeyId: string,
  stage: JourneyStage,
): Promise<StageDetail> {
  const { journey, tasks } = await loadJourneyData(userId, journeyId)

  const progressInput: StageTaskProgressInput[] = tasks.map((t) => ({
    stage: t.stage,
    status: t.status,
    optional: t.optional,
  }))

  const stageProgress = progressByStage(progressInput)
  const views = buildStageViews(journey.currentStage, stageProgress)
  const view = views.find((v) => v.stage === stage)!

  const stageTasks = toTaskViews(tasks, journey.country, journey.blueprintVersion).filter(
    (task) => task.stage === stage,
  )

  const meta = STAGE_META[stage]

  return {
    journeyId: journey.id,
    stage,
    label: meta.label,
    description: meta.description,
    focus: meta.focus,
    importance: STAGE_IMPORTANCE[stage],
    position: view.position,
    totalStages: STAGE_ORDER.length,
    state: view.state,
    lockReason: view.lockReason,
    progress: stageProgressFor(stage, progressInput),
    tasks: stageTasks,
    nextAction: stage === journey.currentStage ? await getNextAction(userId, journey.id) : null,
    tools: STAGE_TOOLS[stage] ?? [],
  }
}

/** De taken van een traject, met blokkering. Voor `/journey/[id]`. */
export async function getJourneyTasks(userId: string, journeyId: string): Promise<TaskView[]> {
  const { journey, tasks } = await loadJourneyData(userId, journeyId)
  return toTaskViews(tasks, journey.country, journey.blueprintVersion)
}

/**
 * Bouwt de context voor de aanbevelingsmotor.
 *
 * Gedeeld door het dashboard en de stagepagina's, zodat "wat is mijn volgende
 * stap" overal hetzelfde antwoord geeft.
 */
export async function buildRecommendationContext(
  userId: string,
  journeyId: string,
): Promise<RecommendationContext> {
  const journey = await repository.requireJourney(userId, journeyId)

  const [tasks, events, documentCategories, quoteCount, preference, savedCount, searchCount] =
    await Promise.all([
      prisma.journeyTask.findMany({
        where: { journeyId, userId },
        select: {
          id: true,
          templateKey: true,
          title: true,
          status: true,
          dueDate: true,
          optional: true,
        },
      }),
      repository.listUpcomingEvents(userId, { limit: 5 }),
      prisma.document.findMany({
        where: { userId, status: { not: DocumentStatus.DELETED } },
        select: { category: true },
        distinct: ['category'],
      }),
      prisma.financingQuote.count({ where: { userId } }),
      prisma.neighborhoodPreference.findUnique({ where: { userId }, select: { id: true } }),
      prisma.savedProperty.count({ where: { userId } }),
      prisma.propertySearch.count({ where: { userId, active: true } }),
    ])

  return {
    journeyId: journey.id,
    stage: journey.currentStage,
    targetBudgetCents: journey.targetBudgetCents,
    ownContributionCents: journey.ownContributionCents,
    needsFinancing: journey.needsFinancing,
    documentCategories: documentCategories.map((d) => d.category),
    savedPropertyCount: savedCount,
    activeSearchCount: searchCount,
    tasks,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      dueAt: e.dueAt,
    })),
    hasFinancingQuote: quoteCount > 0,
    hasNeighborhoodPreference: preference !== null,
  }
}

export async function getRecommendations(
  userId: string,
  journeyId: string,
  limit?: number,
): Promise<Recommendation[]> {
  return buildRecommendations(await buildRecommendationContext(userId, journeyId), limit)
}

export async function getNextAction(
  userId: string,
  journeyId: string,
): Promise<Recommendation | null> {
  return nextBestAction(await buildRecommendationContext(userId, journeyId))
}
