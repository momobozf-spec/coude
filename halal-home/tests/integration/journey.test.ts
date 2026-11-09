/**
 * De volledige flow, tegen een echte database.
 *
 * Dit is wat de unit tests niet kunnen bewijzen: dat de transacties werken, dat
 * de unique constraints doen wat we denken, en dat een dubbele submit
 * daadwerkelijk geen 88 taken oplevert.
 *
 * Draaien: TEST_DATABASE_URL=postgresql://… npm run test:integration
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { JourneyStage, TaskStatus } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import { blueprintTasksFor } from '@/modules/journey/domain/blueprint'
import {
  createJourneyWithBlueprint,
  evaluateJourneyStage,
  setTaskStatus,
} from '@/modules/journey/service'

describeIfDatabase('journey-initialisatie', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('maakt precies de blauwdruktaken aan', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: 'Traject A' })
    const expected = blueprintTasksFor({ country: 'BE', firstHome: true })

    const count = await prisma.journeyTask.count({ where: { journeyId: journey.id } })
    expect(count).toBe(expected.length)
  })

  it('is idempotent: twee keer aanmaken geeft geen dubbele taken', async () => {
    // Dit is §22: onboarding twee keer submitten mag geen 88 taken opleveren.
    const first = await createJourneyWithBlueprint(userId, { name: 'Traject B' })
    const second = await createJourneyWithBlueprint(userId, { name: 'Traject B' })

    expect(second.id).toBe(first.id)

    const count = await prisma.journeyTask.count({ where: { journeyId: first.id } })
    expect(count).toBe(blueprintTasksFor({ country: 'BE', firstHome: true }).length)
  })

  it('legt de blauwdrukversie vast', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: 'Traject C' })
    expect(journey.blueprintVersion).toBeGreaterThan(0)
    expect(journey.initializedAt).not.toBeNull()
  })

  it('slaat de fasen vóór de startfase over in plaats van ze weg te laten', async () => {
    // Wie al een woning gevonden heeft, moet nog steeds kunnen terugbladeren.
    const journey = await createJourneyWithBlueprint(userId, {
      name: 'Traject D',
      startStage: JourneyStage.FINANCING,
    })

    const skipped = await prisma.journeyTask.findMany({
      where: { journeyId: journey.id, stage: JourneyStage.ORIENTATION },
      select: { status: true },
    })

    expect(skipped.length).toBeGreaterThan(0)
    expect(skipped.every((t) => t.status === TaskStatus.SKIPPED)).toBe(true)
  })
})

describeIfDatabase('taken en afhankelijkheden', () => {
  let userId: string
  let journeyId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    const journey = await createJourneyWithBlueprint(userId, { name: 'Takentraject' })
    journeyId = journey.id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  const taskByKey = (key: string) =>
    prisma.journeyTask.findFirstOrThrow({ where: { journeyId, templateKey: key } })

  it('weigert een blokkerende taak te voltooien waarvan de voorwaarde open staat', async () => {
    // Bieden zonder financieringsbewijs is de fout die dit platform moet
    // voorkomen; die afhankelijkheid is BLOCKING.
    const confirm = await taskByKey('OFFER_CONFIRM_FINANCING')
    await expect(setTaskStatus(userId, confirm.id, TaskStatus.COMPLETED)).rejects.toThrow(
      /wacht nog op/i,
    )
  })

  it('deblokkeert de afhankelijke taak zodra de blokkerende voorwaarde af is', async () => {
    const proof = await taskByKey('FINANCING_OBTAIN_PROOF')
    const confirm = await taskByKey('OFFER_CONFIRM_FINANCING')

    const result = await setTaskStatus(userId, proof.id, TaskStatus.COMPLETED)

    expect(result.unlockedTaskIds).toContain(confirm.id)
    await expect(
      setTaskStatus(userId, confirm.id, TaskStatus.COMPLETED),
    ).resolves.toMatchObject({ status: TaskStatus.COMPLETED })
  })

  it('laat een adviserende volgorde het afronden niet tegenhouden', async () => {
    // `BUDGET_ESTIMATE_COSTS` volgt in de UI op `BUDGET_SET_OWN_FUNDS`, maar
    // niemand loopt schade op door het andersom te doen. Werk dat gedaan is,
    // moet als gedaan geregistreerd kunnen worden.
    const costs = await taskByKey('BUDGET_ESTIMATE_COSTS')
    const ownFunds = await taskByKey('BUDGET_SET_OWN_FUNDS')

    expect(ownFunds.status).toBe(TaskStatus.TODO)
    await expect(
      setTaskStatus(userId, costs.id, TaskStatus.COMPLETED),
    ).resolves.toMatchObject({ status: TaskStatus.COMPLETED })
  })

  it('legt het type van elke afhankelijkheid vast in de database', async () => {
    const confirm = await taskByKey('OFFER_CONFIRM_FINANCING')
    const costs = await taskByKey('BUDGET_ESTIMATE_COSTS')

    const blocking = await prisma.taskDependency.findFirst({ where: { taskId: confirm.id } })
    const advisory = await prisma.taskDependency.findFirst({ where: { taskId: costs.id } })

    expect(blocking?.type).toBe('BLOCKING')
    expect(advisory?.type).toBe('ADVISORY')
  })

  it('weigert een verplichte systeemtaak over te slaan', async () => {
    const maxPrice = await taskByKey('BUDGET_SET_MAX_PRICE')
    await expect(setTaskStatus(userId, maxPrice.id, TaskStatus.SKIPPED)).rejects.toThrow(
      /verplicht/i,
    )
  })

  it('staat het overslaan van een optionele taak wél toe', async () => {
    const optional = await prisma.journeyTask.findFirstOrThrow({
      where: { journeyId, optional: true },
    })
    await expect(
      setTaskStatus(userId, optional.id, TaskStatus.SKIPPED),
    ).resolves.toMatchObject({ status: TaskStatus.SKIPPED })
  })

  it('kan een taak heropenen', async () => {
    const ownFunds = await taskByKey('BUDGET_SET_OWN_FUNDS')
    const result = await setTaskStatus(userId, ownFunds.id, TaskStatus.TODO)

    expect(result.status).toBe(TaskStatus.TODO)
    const after = await taskByKey('BUDGET_SET_OWN_FUNDS')
    expect(after.completedAt).toBeNull()
  })
})

describeIfDatabase('fase-overgang', () => {
  let userId: string
  let journeyId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    const journey = await createJourneyWithBlueprint(userId, {
      name: 'Overgangstraject',
      startStage: JourneyStage.BUDGET,
    })
    journeyId = journey.id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('schuift niet door zolang er verplichte taken open staan', async () => {
    const result = await evaluateJourneyStage(userId, journeyId)

    expect(result.advanced).toBe(false)
    expect(result.currentStage).toBe(JourneyStage.BUDGET)
    expect(result.reason).toContain('verplichte')
  })

  it('schuift door zodra de laatste verplichte taak af is', async () => {
    // De volledige keten uit §30: laatste required task afronden → volgende
    // fase wordt actief.
    const tasks = await prisma.journeyTask.findMany({
      where: { journeyId, stage: JourneyStage.BUDGET },
      orderBy: { sortOrder: 'asc' },
    })

    for (const task of tasks) {
      if (task.status === TaskStatus.COMPLETED) continue
      await setTaskStatus(userId, task.id, TaskStatus.COMPLETED)
    }

    const journey = await prisma.homeBuyingJourney.findUniqueOrThrow({
      where: { id: journeyId },
    })
    expect(journey.currentStage).toBe(JourneyStage.FINANCING)
    expect(journey.progressPercentage).toBeGreaterThan(0)
  })
})

describeIfDatabase('user isolation met een echte database', () => {
  let alice: string
  let bob: string
  let aliceJourneyId: string

  beforeAll(async () => {
    alice = (await createUser('Alice')).id
    bob = (await createUser('Bob')).id
    aliceJourneyId = (await createJourneyWithBlueprint(alice, { name: 'Alice traject' })).id
  })

  afterAll(async () => {
    await deleteUser(alice)
    await deleteUser(bob)
  })

  it('Bob kan het traject van Alice niet lezen', async () => {
    const repository = await import('@/modules/journey/repository')
    expect(await repository.findJourney(bob, aliceJourneyId)).toBeNull()
    await expect(repository.requireJourney(bob, aliceJourneyId)).rejects.toThrow()
  })

  it('Bob kan geen taak van Alice voltooien', async () => {
    const task = await prisma.journeyTask.findFirstOrThrow({
      where: { journeyId: aliceJourneyId },
    })
    await expect(setTaskStatus(bob, task.id, TaskStatus.COMPLETED)).rejects.toThrow()

    const after = await prisma.journeyTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(after.status).not.toBe(TaskStatus.COMPLETED)
  })

  it('Bob kan de checklist van Alice niet aanpassen', async () => {
    const { setChecklistItemState } = await import('@/modules/checklist/service')
    const item = await prisma.userChecklistItem.findFirst({
      where: { journeyId: aliceJourneyId },
      include: { item: true },
    })

    if (!item) return // geen checklists geseed in deze database

    await expect(
      setChecklistItemState(bob, aliceJourneyId, item.item.key, 'complete'),
    ).rejects.toThrow()
  })

  it('Bob ziet Alice haar traject niet in zijn eigen lijst', async () => {
    const repository = await import('@/modules/journey/repository')
    const journeys = await repository.listJourneys(bob)
    expect(journeys.map((j) => j.id)).not.toContain(aliceJourneyId)
  })
})
