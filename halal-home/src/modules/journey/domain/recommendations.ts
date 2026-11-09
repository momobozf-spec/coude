/**
 * De aanbevelingsmotor.
 *
 * REGELS, GEEN AI. Bewust.
 *
 * Een gebruiker die op zijn dashboard leest "upload je loonfiches" moet erop
 * kunnen rekenen dat die zin klopt — dat het systeem werkelijk heeft gekeken en
 * geen inkomensdocument heeft gevonden. Een taalmodel dat een dashboard
 * "invult" produceert plausibele zinnen, geen gecontroleerde feiten, en het
 * verschil is voor de gebruiker onzichtbaar.
 *
 * De regels hieronder zijn volledig deterministisch en testbaar. AI mag de
 * uitkomst later mooier formuleren, maar bepaalt nooit wélke processtap volgt.
 *
 * ─── WAAROM NU? ──────────────────────────────────────────────────────────────
 *
 * Elke aanbeveling draagt een `reason`: de toestand die hem heeft opgeroepen,
 * in gewone taal. "Je budget is ingevuld en je gaf aan financiering nodig te
 * hebben." Zo is een aanbeveling een gevolgtrekking die de gebruiker kan
 * controleren, en niet een mening van de app.
 */
import { DocumentCategory, JourneyStage, TaskStatus } from '@prisma/client'
import { isAtOrAfter, STAGE_META } from './stages'
import { daysUntil } from '@/lib/utils'

export type RecommendationSeverity = 'critical' | 'important' | 'suggestion'

/** Wat de gebruiker moet doen. Bepaalt het label op de kaart. */
export type RecommendationEffort = 'quick' | 'document' | 'task' | 'decision'

export const EFFORT_LABELS: Record<RecommendationEffort, string> = {
  quick: '5 min',
  document: 'Document',
  task: 'Taak',
  decision: 'Keuze',
}

export interface Recommendation {
  /** Stabiele sleutel; hierop dedupliceren en testen we. */
  key: string
  severity: RecommendationSeverity
  effort: RecommendationEffort
  title: string
  /** Wat je moet doen, in gewone taal. */
  body: string
  /** Waarom dit nu verschijnt — de toestand die de regel opriep. */
  reason: string
  actionLabel: string
  actionHref: string
}

/** Alles wat de regels nodig hebben. Bewust platte data: geen Prisma-typen. */
export interface RecommendationContext {
  journeyId: string
  stage: JourneyStage

  /** Bedragen in eurocent. Zie src/lib/money.ts. */
  targetBudgetCents: number | null
  ownContributionCents: number | null
  needsFinancing: boolean | null

  documentCategories: readonly DocumentCategory[]
  savedPropertyCount: number
  activeSearchCount: number

  tasks: readonly {
    id: string
    templateKey: string | null
    title: string
    status: TaskStatus
    dueDate: Date | null
    optional?: boolean
  }[]
  events: readonly { id: string; title: string; startsAt: Date | null; dueAt: Date | null }[]

  hasFinancingQuote: boolean
  hasNeighborhoodPreference: boolean

  now?: Date
}

type Rule = (context: RecommendationContext) => Recommendation | null

/**
 * Hoeveel dagen vooraf een deadline "nabij" is. Zeven dagen is een keuze: kort
 * genoeg om urgent te voelen, lang genoeg om er nog iets aan te doen.
 */
const DEADLINE_HORIZON_DAYS = 7

const hasDocument = (context: RecommendationContext, category: DocumentCategory) =>
  context.documentCategories.includes(category)

/**
 * Staat deze blauwdruktaak nog open?
 *
 * Vereist dat de taak bestáát. Een taak die niet in de context zit, levert
 * `false` op — geen aanbeveling dus.
 *
 * Dat is bewust: een regel mag alleen afgaan op positief bewijs. Afwezigheid
 * behandelen als "niet gedaan" betekent dat een gebruiker een aanmaning krijgt
 * voor werk waarvan we niet weten of het bestaat, en dat is precies het soort
 * onterechte melding dat mensen een dashboard doet negeren.
 */
const isTaskOpen = (context: RecommendationContext, templateKey: string) => {
  const task = context.tasks.find((t) => t.templateKey === templateKey)
  if (!task) return false
  return task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.SKIPPED
}

const inStage = (context: RecommendationContext, stage: JourneyStage) =>
  isAtOrAfter(context.stage, stage)

const RULES: Rule[] = [
  // ── Budget ────────────────────────────────────────────────────────────────
  (c) =>
    inStage(c, JourneyStage.BUDGET) && c.ownContributionCents === null
      ? {
          key: 'budget.own_contribution_missing',
          severity: 'important',
          effort: 'quick',
          title: 'Bereken hoeveel eigen middelen je beschikbaar hebt',
          body: 'Je eigen inbreng bepaalt wat je moet financieren én welke producten voor je open staan.',
          reason: `Je traject staat in de fase ${STAGE_META[c.stage].label.toLowerCase()} en je eigen middelen zijn nog niet ingevuld.`,
          actionLabel: 'Eigen middelen invullen',
          actionHref: `/journey/${c.journeyId}/stage/BUDGET`,
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.BUDGET) &&
    c.targetBudgetCents === null &&
    c.ownContributionCents !== null
      ? {
          key: 'budget.missing',
          severity: 'important',
          effort: 'decision',
          title: 'Leg je maximale aankoopprijs vast',
          body: 'Zonder budget kunnen we geen woningen filteren en geen financiering vergelijken.',
          reason: 'Je eigen middelen zijn bekend, maar je maximale aankoopprijs nog niet.',
          actionLabel: 'Budget instellen',
          actionHref: `/journey/${c.journeyId}/stage/BUDGET`,
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.BUDGET) &&
    c.targetBudgetCents !== null &&
    isTaskOpen(c, 'BUDGET_ESTIMATE_COSTS')
      ? {
          key: 'budget.costs_not_estimated',
          severity: 'important',
          effort: 'quick',
          title: 'Bereken je bijkomende aankoopkosten',
          body:
            'Registratierechten en notariskosten komen bovenop de aankoopprijs. Reken ze door zodat ' +
            'je weet hoeveel eigen geld je werkelijk nodig hebt.',
          reason: 'Je budget staat vast, maar de aankoopkosten zijn nog niet berekend.',
          actionLabel: 'Kosten berekenen',
          actionHref: '/financing/costs',
        }
      : null,

  // ── Financiering ──────────────────────────────────────────────────────────
  (c) =>
    inStage(c, JourneyStage.FINANCING) && c.needsFinancing !== false && !c.hasFinancingQuote
      ? {
          key: 'financing.no_comparison',
          severity: 'important',
          effort: 'task',
          title: 'Vergelijk financieringsmogelijkheden',
          body:
            'Bekijk per aanbieder hoe de constructie werkt, wie ze eventueel certificeert en wat ' +
            'de bron is. Je ziet meteen wat je maandelijks zou betalen.',
          reason:
            c.targetBudgetCents !== null
              ? 'Je budget is ingevuld en je gaf aan financiering nodig te hebben.'
              : 'Je gaf aan financiering nodig te hebben.',
          actionLabel: 'Vergelijken',
          actionHref: '/financing',
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.FINANCING) && !hasDocument(c, DocumentCategory.INCOME)
      ? {
          key: 'financing.income_documents_missing',
          severity: 'critical',
          effort: 'document',
          title: 'Upload je laatste loonfiches',
          body:
            'Elke aanbieder vraagt hierom. Zonder inkomensbewijs kan je financiering niet ' +
            'voorbereid worden en loop je vertraging op wanneer je wil bieden.',
          reason: 'Je bent in de financieringsfase en er is nog geen inkomensdocument geüpload.',
          actionLabel: 'Documenten uploaden',
          actionHref: '/documents?category=INCOME',
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.FINANCING) && !hasDocument(c, DocumentCategory.IDENTITY)
      ? {
          key: 'financing.identity_documents_missing',
          severity: 'important',
          effort: 'document',
          title: 'Upload je identiteitsdocumenten',
          body: 'Je identiteitskaart is nodig bij zowel de aanbieder als de notaris.',
          reason: 'Je bent in de financieringsfase en er is nog geen identiteitsdocument geüpload.',
          actionLabel: 'Documenten uploaden',
          actionHref: '/documents?category=IDENTITY',
        }
      : null,

  // ── Zoeken ────────────────────────────────────────────────────────────────
  (c) =>
    inStage(c, JourneyStage.PROPERTY_SEARCH) && c.activeSearchCount === 0
      ? {
          key: 'search.none_active',
          severity: 'important',
          effort: 'task',
          title: 'Maak je eerste woningzoekopdracht',
          body: 'Beschrijf in gewone taal wat je zoekt; wij zetten het om in criteria en houden het bij.',
          reason: 'Je bent klaar om woningen te gaan vergelijken en hebt nog geen zoekopdracht.',
          actionLabel: 'Start',
          actionHref: '/search/new',
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.VIEWINGS) && c.savedPropertyCount === 0
      ? {
          key: 'search.no_saved_properties',
          severity: 'suggestion',
          effort: 'task',
          title: 'Bewaar woningen die je aanspreken',
          body: 'Zo kan je ze vergelijken en bezichtigingen plannen vanuit één overzicht.',
          reason: 'Je bent in de bezichtigingsfase maar hebt nog geen woningen bewaard.',
          actionLabel: 'Naar zoeken',
          actionHref: '/search',
        }
      : null,

  (c) =>
    !c.hasNeighborhoodPreference
      ? {
          key: 'neighborhood.no_preferences',
          severity: 'suggestion',
          effort: 'quick',
          title: 'Stel je buurtvoorkeuren in',
          body:
            'Geef aan hoe zwaar een moskee, school of halal winkel voor je weegt. Daarmee ' +
            'berekenen we per woning een buurtscore die bij jóu past.',
          reason: 'Je hebt nog geen buurtvoorkeuren ingesteld.',
          actionLabel: 'Voorkeuren instellen',
          actionHref: '/neighborhood/preferences',
        }
      : null,

  // ── Bod ───────────────────────────────────────────────────────────────────
  (c) =>
    inStage(c, JourneyStage.OFFER) && !hasDocument(c, DocumentCategory.FINANCING)
      ? {
          key: 'offer.no_financing_proof',
          severity: 'critical',
          effort: 'document',
          title: 'Bied niet zonder financieringsbewijs',
          body:
            'Je hebt nog geen financieringsdocument geüpload. Een bod zonder zekerheid over je ' +
            'financiering kan je duur komen te staan als je het niet rond krijgt.',
          reason: 'Je bent in de bodfase en er is geen financieringsbewijs in je dossier.',
          actionLabel: 'Financieringsbewijs toevoegen',
          actionHref: '/documents?category=FINANCING',
        }
      : null,

  // ── Notaris en administratie ──────────────────────────────────────────────
  (c) =>
    inStage(c, JourneyStage.NOTARY) && !hasDocument(c, DocumentCategory.PURCHASE_AGREEMENT)
      ? {
          key: 'notary.no_agreement',
          severity: 'critical',
          effort: 'document',
          title: 'Upload de getekende koopovereenkomst',
          body: 'De notaris heeft het compromis nodig om de akte te kunnen voorbereiden.',
          reason: 'Je bent in de notarisfase en de koopovereenkomst ontbreekt in je dossier.',
          actionLabel: 'Overeenkomst uploaden',
          actionHref: '/documents?category=PURCHASE_AGREEMENT',
        }
      : null,

  (c) =>
    inStage(c, JourneyStage.INSURANCE_ADMIN) && !hasDocument(c, DocumentCategory.INSURANCE)
      ? {
          key: 'insurance.no_fire_insurance',
          severity: 'critical',
          effort: 'task',
          title: 'Regel je brandverzekering',
          body: 'Die moet in orde zijn vanaf de dag dat je de akte tekent.',
          reason: 'Je bent in de administratiefase en er is nog geen verzekeringsdocument.',
          actionLabel: 'Verzekering toevoegen',
          actionHref: '/documents?category=INSURANCE',
        }
      : null,
]

/** Deadlines zijn geen vaste regel maar volgen uit de data. */
function deadlineRecommendations(context: RecommendationContext): Recommendation[] {
  const now = context.now ?? new Date()
  const out: Recommendation[] = []

  for (const task of context.tasks) {
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.SKIPPED) continue
    if (!task.dueDate) continue

    const days = daysUntil(task.dueDate, now)
    if (days > DEADLINE_HORIZON_DAYS) continue

    out.push({
      key: `deadline.task.${task.id}`,
      severity: days < 0 ? 'critical' : 'important',
      effort: 'task',
      title: days < 0 ? `Verstreken: ${task.title}` : `Bijna deadline: ${task.title}`,
      body:
        days < 0
          ? `Deze taak stond ${Math.abs(days)} dag${Math.abs(days) === 1 ? '' : 'en'} geleden gepland.`
          : days === 0
            ? 'Deze taak staat vandaag gepland.'
            : `Nog ${days} dag${days === 1 ? '' : 'en'}.`,
      reason: 'Deze taak heeft een deadline die nadert of verstreken is.',
      actionLabel: 'Naar taak',
      actionHref: `/journey/${context.journeyId}#task-${task.id}`,
    })
  }

  for (const event of context.events) {
    const moment = event.startsAt ?? event.dueAt
    if (!moment) continue

    const days = daysUntil(moment, now)
    if (days < 0 || days > DEADLINE_HORIZON_DAYS) continue

    out.push({
      key: `deadline.event.${event.id}`,
      severity: days <= 1 ? 'important' : 'suggestion',
      effort: 'task',
      title: event.title,
      body: days === 0 ? 'Vandaag.' : days === 1 ? 'Morgen.' : `Over ${days} dagen.`,
      reason: 'Deze afspraak staat binnenkort gepland.',
      actionLabel: 'Naar agenda',
      actionHref: `/journey/${context.journeyId}`,
    })
  }

  return out
}

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = {
  critical: 0,
  important: 1,
  suggestion: 2,
}

/** Bovengrens op wat het dashboard toont. Zie `buildRecommendations`. */
export const MAX_RECOMMENDATIONS = 5

/**
 * De aanbevelingen voor dit dashboard, gesorteerd op urgentie.
 *
 * De limiet bestaat omdat een lijst van vijftien openstaande punten niemand
 * verder helpt: dan wordt het behang en kijkt de gebruiker eroverheen. Geen
 * oneindige feed.
 */
export function buildRecommendations(
  context: RecommendationContext,
  limit: number = MAX_RECOMMENDATIONS,
): Recommendation[] {
  const fromRules = RULES.map((rule) => rule(context)).filter(
    (r): r is Recommendation => r !== null,
  )

  return [...fromRules, ...deadlineRecommendations(context)]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, Math.min(limit, MAX_RECOMMENDATIONS))
}

/**
 * De ene stap die het dashboard bovenaan zet als "volgende stap".
 *
 * Bewust de eerste aanbeveling en niet een aparte berekening: twee bronnen voor
 * "wat moet ik nu doen" die uit de pas kunnen lopen, is precies één te veel.
 */
export function nextBestAction(context: RecommendationContext): Recommendation | null {
  return buildRecommendations(context, 1)[0] ?? null
}
