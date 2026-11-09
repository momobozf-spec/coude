/**
 * De onboarding, tegen een echte database.
 *
 * Wat hier bewezen wordt en in unit tests niet kan: hervatten na afhaken, en dat
 * twee keer afronden precies één traject oplevert.
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { OnboardingGoal, PurchaseTimeline } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import {
  completeOnboarding,
  getOnboardingState,
  resetOnboarding,
  saveStep,
} from '@/modules/onboarding/service'
import { blueprintTasksFor } from '@/modules/journey/domain/blueprint'

const STEPS = {
  goal: { goal: OnboardingGoal.READY_TO_BUY },
  location: { country: 'BE' as const, region: 'FLANDERS' as const, city: 'Gent' },
  budget: {
    maxBudgetCents: 450_000_00,
    ownFundsCents: 90_000_00,
    needsFinancing: true,
  },
  timing: { timeline: PurchaseTimeline.WITHIN_6_MONTHS },
  priorities: { priorities: ['mosque_nearby' as const] },
}

async function runFullOnboarding(userId: string) {
  await saveStep(userId, 1, STEPS.goal)
  await saveStep(userId, 2, STEPS.location)
  await saveStep(userId, 3, STEPS.budget)
  await saveStep(userId, 4, STEPS.timing)
  await saveStep(userId, 5, STEPS.priorities)
}

describeIfDatabase('onboarding afronden', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('maakt een traject met alle blauwdruktaken', async () => {
    await runFullOnboarding(userId)
    const result = await completeOnboarding(userId)

    expect(result.created).toBe(true)

    const count = await prisma.journeyTask.count({ where: { journeyId: result.journeyId } })
    expect(count).toBe(blueprintTasksFor({ country: 'BE', firstHome: true }).length)
  })

  it('zet het budget in centen over naar het traject', async () => {
    const journey = await prisma.homeBuyingJourney.findFirstOrThrow({ where: { userId } })

    expect(journey.targetBudgetCents).toBe(450_000_00)
    expect(journey.ownContributionCents).toBe(90_000_00)
    expect(journey.targetLocation).toBe('Gent')
    expect(journey.region).toBe('FLANDERS')
  })

  it('geeft bij een tweede submit hetzelfde traject terug', async () => {
    // §22: dubbele submit mag geen tweede traject en geen 88 taken opleveren.
    const first = await completeOnboarding(userId)
    const second = await completeOnboarding(userId)

    expect(second.journeyId).toBe(first.journeyId)
    expect(second.created).toBe(false)

    const journeys = await prisma.homeBuyingJourney.count({ where: { userId } })
    expect(journeys).toBe(1)

    const tasks = await prisma.journeyTask.count({ where: { userId } })
    expect(tasks).toBe(blueprintTasksFor({ country: 'BE', firstHome: true }).length)
  })

  it('markeert de gebruiker als onboarded', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.onboardingCompleted).toBe(true)
  })
})

describeIfDatabase('onboarding hervatten', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('onthoudt waar de gebruiker gebleven is', async () => {
    await saveStep(userId, 1, STEPS.goal)
    await saveStep(userId, 2, STEPS.location)

    const state = await getOnboardingState(userId)

    expect(state.completed).toBe(false)
    expect(state.currentStep).toBe(3)
    expect(state.draft.city).toBe('Gent')
    expect(state.draft.goal).toBe(OnboardingGoal.READY_TO_BUY)
  })

  it('weigert af te ronden zolang de onboarding onvolledig is', async () => {
    await expect(completeOnboarding(userId)).rejects.toThrow(/niet compleet/i)
  })

  it('laat een eerdere stap corrigeren zonder de voortgang te verliezen', async () => {
    await saveStep(userId, 2, { ...STEPS.location, city: 'Antwerpen' })
    const state = await getOnboardingState(userId)

    expect(state.draft.city).toBe('Antwerpen')
    // Het doel uit stap 1 blijft staan.
    expect(state.draft.goal).toBe(OnboardingGoal.READY_TO_BUY)
  })

  it('kan opnieuw beginnen', async () => {
    await resetOnboarding(userId)
    const state = await getOnboardingState(userId)

    expect(state.currentStep).toBe(1)
    expect(state.draft.goal).toBeUndefined()
  })
})

describeIfDatabase('startfase volgt uit het doel', () => {
  let orienting: string
  let ready: string

  beforeAll(async () => {
    orienting = (await createUser('Oriënterend')).id
    ready = (await createUser('Klaar')).id
  })

  afterAll(async () => {
    await deleteUser(orienting)
    await deleteUser(ready)
  })

  it('laat wie zich oriënteert bij oriëntatie starten', async () => {
    await saveStep(orienting, 1, { goal: OnboardingGoal.ORIENTING })
    await saveStep(orienting, 2, STEPS.location)
    await saveStep(orienting, 3, STEPS.budget)
    await saveStep(orienting, 4, STEPS.timing)
    await saveStep(orienting, 5, STEPS.priorities)

    const { journeyId } = await completeOnboarding(orienting)
    const journey = await prisma.homeBuyingJourney.findUniqueOrThrow({ where: { id: journeyId } })

    expect(journey.currentStage).toBe('ORIENTATION')
  })

  it('laat wie klaar is om te kopen bij budget starten', async () => {
    await saveStep(ready, 1, { goal: OnboardingGoal.READY_TO_BUY })
    await saveStep(ready, 2, STEPS.location)
    await saveStep(ready, 3, STEPS.budget)
    await saveStep(ready, 4, STEPS.timing)
    await saveStep(ready, 5, STEPS.priorities)

    const { journeyId } = await completeOnboarding(ready)
    const journey = await prisma.homeBuyingJourney.findUniqueOrThrow({ where: { id: journeyId } })

    expect(journey.currentStage).toBe('BUDGET')
  })
})
