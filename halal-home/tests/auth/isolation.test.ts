/**
 * User isolation.
 *
 * Deze tests draaien zonder database: ze vervangen de Prisma-client door een
 * spion en controleren dat élke query een `userId` in de WHERE-clausule zet.
 *
 * Waarom zo, en niet met een echte database? Omdat de fout die we willen
 * uitsluiten geen datafout is maar een codefout: iemand schrijft ooit
 * `findUnique({ where: { id } })` in plaats van `findFirst({ where: { id,
 * userId } })`. Dat werkt perfect, geeft nette data terug, en lekt het traject
 * van iemand anders. Een integratietest met twee gebruikers vangt dat pas als je
 * toevallig het juiste scenario schrijft; deze test vangt het altijd.
 *
 * De integratietests in `tests/integration/` doen de andere kant: die
 * controleren met een échte database dat gebruiker A niets van B kan lezen of
 * schrijven. Ze draaien alleen wanneer `TEST_DATABASE_URL` gezet is.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { model: string; method: string; args: Record<string, unknown> }[] = []

const USER = 'user_aaa'
const OTHER = 'user_bbb'

/**
 * Een Proxy die elke `prisma.<model>.<methode>(args)` opvangt en vastlegt.
 * Zo hoeven we niet elk model apart te mocken.
 */
function createSpyClient() {
  const model = new Proxy(
    {},
    {
      get(_t, method: string) {
        return (args: Record<string, unknown> = {}) => {
          calls.push({ model: 'unknown', method, args })
          if (method === 'findMany') return Promise.resolve([])
          if (method === 'count') return Promise.resolve(0)
          if (method === 'updateMany') return Promise.resolve({ count: 1 })
          // findFirst/findUnique geven een rij terug in plaats van null, zodat
          // functies die daarna nog een `requireX` doen niet stranden voordat de
          // query die we wíllen controleren is uitgevoerd.
          return Promise.resolve({ id: 'row_1', userId: USER })
        }
      },
    },
  )

  return new Proxy(
    {},
    {
      get(_target, modelName: string) {
        if (modelName === 'then') return undefined
        return new Proxy(
          {},
          {
            get(_t, method: string) {
              return (args: Record<string, unknown> = {}) => {
                calls.push({ model: modelName, method, args })
                return (model as Record<string, (a: unknown) => unknown>)[method]!(args)
              }
            },
          },
        )
      },
    },
  )
}

vi.mock('@/server/db/prisma', () => ({ prisma: createSpyClient() }))

// Statische imports in plaats van een dynamische import per test.
// `vi.mock` wordt gehoist en geldt dus ook voor deze imports.
//
// Waarom dit uitmaakt: met dynamische imports laadde de eerste test de
// volledige modulegraaf en kwam die daarmee soms boven de time-out van vijf
// seconden uit. Erger nog, zijn opgenomen aanroepen lekten dan door naar de
// test erna, die vervolgens óók faalde — op een reden die niets met isolatie
// te maken had.
import { TaskStatus } from '@prisma/client'
import * as journeyRepository from '@/modules/journey/repository'
import * as checklistRepository from '@/modules/checklist/repository'

/** Haalt de userId uit een where-clausule, ongeacht de vorm. */
function userIdInWhere(where: unknown): string | undefined {
  if (!where || typeof where !== 'object') return undefined
  const record = where as Record<string, unknown>
  return typeof record.userId === 'string' ? record.userId : undefined
}

/** De aanroepen die de spion registreerde, zonder de interne dubbele push. */
const realCalls = () => calls.filter((c) => c.model !== 'unknown')

beforeEach(() => {
  calls.length = 0
})

describe('journey — elke leesactie filtert op de ingelogde gebruiker', () => {
  it('listJourneys', async () => {
    await journeyRepository.listJourneys(USER)
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('findActiveJourney', async () => {
    await journeyRepository.findActiveJourney(USER)
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('findJourney gebruikt findFirst met userId, niet findUnique op id alleen', async () => {
    // findUnique kan geen userId in de WHERE hebben — dat is precies hoe het
    // gat ontstaat.
    await journeyRepository.findJourney(USER, 'journey_1')

    expect(realCalls()[0]?.method).toBe('findFirst')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('findJourneyWithTasks', async () => {
    await journeyRepository.findJourneyWithTasks(USER, 'journey_1')

    expect(realCalls()[0]?.method).toBe('findFirst')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('listTasks', async () => {
    await journeyRepository.listTasks(USER, 'journey_1')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('findTask', async () => {
    await journeyRepository.findTask(USER, 'task_1')

    expect(realCalls()[0]?.method).toBe('findFirst')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('listOpenTasks', async () => {
    await journeyRepository.listOpenTasks(USER)
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('listUpcomingEvents', async () => {
    await journeyRepository.listUpcomingEvents(USER)
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })
})

describe('journey — elke schrijfactie filtert op de ingelogde gebruiker', () => {
  it('updateTaskStatus gebruikt updateMany zodat userId in de WHERE past', async () => {
    // `update` matcht alleen op unieke velden; dan zou userId niet in de WHERE
    // kunnen. updateMany houdt de eigendomscheck in de query zelf.
    await journeyRepository.updateTaskStatus(USER, 'task_1', TaskStatus.COMPLETED)

    expect(realCalls()[0]?.method).toBe('updateMany')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('createJourney koppelt het traject aan de ingelogde gebruiker', async () => {
    await journeyRepository.createJourney(USER, { name: 'Test' })

    const data = realCalls()[0]?.args.data as Record<string, unknown>
    expect(data.userId).toBe(USER)
  })

  it('updateJourney filtert op userId', async () => {
    await journeyRepository.updateJourney(USER, 'journey_1', { name: 'Nieuw' })

    const update = realCalls().find((c) => c.method === 'updateMany')
    expect(userIdInWhere(update?.args.where)).toBe(USER)
  })
})

describe('checklist — voortgang is per gebruiker afgeschermd', () => {
  it('listUserItems filtert op userId én journeyId', async () => {
    await checklistRepository.listUserItems(USER, 'journey_1')

    const where = realCalls()[0]?.args.where as Record<string, unknown>
    expect(where.userId).toBe(USER)
    expect(where.journeyId).toBe('journey_1')
  })

  it('findUserItem gebruikt findFirst met userId', async () => {
    await checklistRepository.findUserItem(USER, 'item_1')

    expect(realCalls()[0]?.method).toBe('findFirst')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('updateUserItem filtert op userId', async () => {
    await checklistRepository.updateUserItem(USER, 'item_1', { completed: true })

    expect(realCalls()[0]?.method).toBe('updateMany')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })

  it('countOpenRequired filtert op userId', async () => {
    await checklistRepository.countOpenRequired(USER, 'journey_1')
    expect(userIdInWhere(realCalls()[0]?.args.where)).toBe(USER)
  })
})

describe('een id van iemand anders geeft geen toegang', () => {
  it('de userId uit de sessie wint altijd van het meegegeven id', async () => {
    await journeyRepository.findJourney(USER, 'journey_van_iemand_anders')

    const where = realCalls()[0]?.args.where as Record<string, unknown>
    expect(where.userId).toBe(USER)
    expect(where.userId).not.toBe(OTHER)
    // Het journeyId zit er wél in, maar nooit zónder de userId ernaast.
    expect(where.id).toBe('journey_van_iemand_anders')
  })

  it('geen enkele repository-functie doet een findUnique op een id alleen', async () => {
    // findUnique kan per definitie geen userId in de WHERE hebben. Elke
    // gebruikersgebonden lookup moet dus findFirst zijn.

    calls.length = 0
    await journeyRepository.findJourney(USER, 'x')
    await journeyRepository.findTask(USER, 'x')
    await checklistRepository.findUserItem(USER, 'x')

    for (const call of realCalls()) {
      expect(call.method, `${call.model}.${call.method} mag geen findUnique zijn`).not.toBe(
        'findUnique',
      )
    }
  })
})
