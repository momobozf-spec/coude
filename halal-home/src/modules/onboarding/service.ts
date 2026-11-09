/**
 * Onboardinglogica.
 *
 * Twee verantwoordelijkheden:
 *   1. een stap opslaan en de wizard hervatbaar houden;
 *   2. bij het afronden precies één traject aanmaken, hoe vaak iemand ook op de
 *      knop drukt.
 */
import 'server-only'
import { AnalyticsEventType, OnboardingGoal, PurchaseType } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { ValidationError } from '@/lib/errors'
import { recordEvent } from '@/modules/analytics/service'
import { createJourneyWithBlueprint } from '@/modules/journey/service'
import { startStageForGoal } from '@/modules/journey/domain/stageState'
import {
  firstIncompleteStep,
  isDraftComplete,
  onboardingDraftSchema,
  stepDefinition,
  targetDateFor,
  TOTAL_ONBOARDING_STEPS,
  type OnboardingDraft,
  type PriorityKey,
} from './schema'

export interface OnboardingState {
  draft: OnboardingDraft
  /** De stap die de gebruiker nu te zien krijgt. */
  currentStep: number
  totalSteps: number
  completed: boolean
  /** Het traject dat uit deze onboarding is voortgekomen, als het er is. */
  journeyId: string | null
}

/**
 * Waar staat deze gebruiker?
 *
 * Leest het opgeslagen concept en valideert het. Een document dat niet meer
 * valideert (bijvoorbeeld doordat het schema wijzigde) wordt behandeld als leeg
 * in plaats van te gooien: dan begint de gebruiker opnieuw, wat vervelend is
 * maar oneindig veel beter dan een onboarding die niet meer opent.
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarding: true, onboardingStep: true, onboardingCompleted: true },
  })
  if (!user) throw new ValidationError('Gebruiker niet gevonden')

  const parsed = onboardingDraftSchema.safeParse(user.onboarding ?? {})
  const draft = parsed.success ? parsed.data : {}

  const journey = await prisma.homeBuyingJourney.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return {
    draft,
    // De opgeslagen stap is leidend zolang hij vooruit ligt op wat het concept
    // aangeeft; zo kan iemand terugbladeren zonder dat de wizard hem meteen
    // weer vooruit duwt.
    currentStep: user.onboardingCompleted
      ? TOTAL_ONBOARDING_STEPS
      : Math.min(Math.max(user.onboardingStep + 1, 1), firstIncompleteStep(draft)),
    totalSteps: TOTAL_ONBOARDING_STEPS,
    completed: user.onboardingCompleted,
    journeyId: journey?.id ?? null,
  }
}

/**
 * Slaat één stap op.
 *
 * De stapgegevens worden gevalideerd met het schema van díe stap en samengevoegd
 * met het bestaande concept. Terugbladeren en een antwoord wijzigen mag: dan
 * blijft `onboardingStep` op de hoogste bereikte waarde staan.
 */
export async function saveStep(
  userId: string,
  step: number,
  data: unknown,
): Promise<OnboardingState> {
  const definition = stepDefinition(step)
  if (!definition) throw new ValidationError(`Onbekende onboardingstap: ${step}`)

  const parsed = definition.schema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationError('Controleer je antwoorden', {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    })
  }

  const current = await getOnboardingState(userId)
  const merged = { ...current.draft, ...parsed.data }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboarding: merged,
      onboardingStep: Math.max(step, current.draft ? step : 0),
    },
  })

  await recordEvent({
    userId,
    type:
      step === 1
        ? AnalyticsEventType.ONBOARDING_STARTED
        : AnalyticsEventType.ONBOARDING_STEP_COMPLETED,
    properties: { step },
  })

  return getOnboardingState(userId)
}

export interface CompleteResult {
  journeyId: string
  /** False wanneer het traject al bestond — een dubbele submit dus. */
  created: boolean
}

/**
 * Rondt de onboarding af en maakt het traject.
 *
 * ─── DUBBELE SUBMIT ──────────────────────────────────────────────────────────
 *
 * Wie twee keer klikt (of wiens verbinding hapert en de POST herhaalt), mag geen
 * tweede traject krijgen. Twee sloten:
 *
 *   1. hier: bestaat er al een geïnitialiseerd traject voor deze gebruiker, dan
 *      geven we dát terug en doen we verder niets;
 *   2. in `createJourneyWithBlueprint`: de unique constraint op (userId, name)
 *      plus het `initializedAt`-vlag vangen ook de race waarin twee requests
 *      tegelijk deze controle passeren.
 */
export async function completeOnboarding(userId: string): Promise<CompleteResult> {
  const state = await getOnboardingState(userId)

  const existing = await prisma.homeBuyingJourney.findFirst({
    where: { userId, initializedAt: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) {
    await markUserOnboarded(userId)
    return { journeyId: existing.id, created: false }
  }

  if (!isDraftComplete(state.draft)) {
    throw new ValidationError(
      'Je onboarding is nog niet compleet. Vul de ontbrekende stappen aan.',
      { nextStep: firstIncompleteStep(state.draft) },
    )
  }

  const draft = state.draft
  const goal = draft.goal ?? OnboardingGoal.ORIENTING
  const now = new Date()

  const journey = await createJourneyWithBlueprint(userId, {
    name: 'Mijn woningtraject',
    country: draft.country ?? 'BE',
    region: draft.region ?? null,
    targetBudgetCents: draft.maxBudgetCents ?? null,
    ownContributionCents: draft.ownFundsCents ?? null,
    needsFinancing: draft.needsFinancing ?? null,
    targetLocation: draft.city ?? null,
    targetPostalCode: draft.postalCode ?? null,
    searchRadiusKm: draft.radiusKm ?? null,
    purchaseType: draft.purchaseType ?? PurchaseType.EXISTING,
    timeline: draft.timeline,
    targetDate: draft.timeline ? targetDateFor(draft.timeline, now) : null,
    firstHome: draft.firstHome ?? true,
    startStage: startStageForGoal(goal),
  })

  await applyPriorities(userId, draft.priorities ?? [])
  await markUserOnboarded(userId)

  await recordEvent({
    userId,
    type: AnalyticsEventType.ONBOARDING_COMPLETED,
    properties: {
      goal,
      timeline: draft.timeline ?? null,
      purchaseType: draft.purchaseType ?? PurchaseType.EXISTING,
      needsFinancing: draft.needsFinancing ?? null,
      region: draft.region ?? null,
      itemCount: (draft.priorities ?? []).length,
    },
  })

  return { journeyId: journey.id, created: true }
}

async function markUserOnboarded(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true, onboardingStep: TOTAL_ONBOARDING_STEPS },
  })
}

/**
 * Zet de gekozen prioriteiten om in buurtgewichten.
 *
 * Alleen de prioriteiten die over de buurt gaan landen hier; de rest
 * (halal-financiering, lage maandlast, energiezuinig) stuurt later de
 * zoekcriteria en de financieringsvergelijking aan.
 *
 * Gewicht 4 = zeer belangrijk. Wie niets kiest, houdt de standaardgewichten:
 * een lege keuze is geen uitspraak dat alles onbelangrijk is.
 */
async function applyPriorities(userId: string, priorities: readonly PriorityKey[]): Promise<void> {
  if (priorities.length === 0) return

  const chosen = new Set(priorities)
  const weightFor = (key: PriorityKey, fallback: number) => (chosen.has(key) ? 4 : fallback)

  const weights = {
    mosqueWeight: weightFor('mosque_nearby', 2),
    schoolWeight: weightFor('schools_nearby', 2),
    publicTransportWeight: weightFor('public_transport', 2),
  }

  await prisma.neighborhoodPreference.upsert({
    where: { userId },
    create: { userId, ...weights },
    update: weights,
  })
}

/** Zet de onboarding terug op het begin. Voor "opnieuw beginnen" in het profiel. */
export async function resetOnboarding(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboarding: {}, onboardingStep: 0, onboardingCompleted: false },
  })
}
