import { describe, expect, it } from 'vitest'
import { JourneyStage, TaskStatus } from '@prisma/client'

import { progressByStage, type StageTaskProgressInput } from '@/modules/journey/domain/progress'
import {
  buildStageViews,
  canAdvanceStage,
  stagesBefore,
  startStageForGoal,
} from '@/modules/journey/domain/stageState'
import { STAGE_ORDER } from '@/modules/journey/domain/stages'

/** Bouwt taken voor een fase met een gegeven aantal open verplichte taken. */
const stageTasks = (
  stage: JourneyStage,
  open: number,
  done: number,
): StageTaskProgressInput[] => [
  ...Array.from({ length: open }, () => ({ stage, status: TaskStatus.TODO, optional: false })),
  ...Array.from({ length: done }, () => ({
    stage,
    status: TaskStatus.COMPLETED,
    optional: false,
  })),
]

const viewsFor = (current: JourneyStage, tasks: StageTaskProgressInput[]) =>
  buildStageViews(current, progressByStage(tasks))

describe('toestand van elke fase', () => {
  it('markeert eerdere fasen als afgerond en de huidige als current', () => {
    const views = viewsFor(JourneyStage.FINANCING, stageTasks(JourneyStage.FINANCING, 2, 0))

    expect(views.find((v) => v.stage === JourneyStage.ORIENTATION)?.state).toBe('COMPLETED')
    expect(views.find((v) => v.stage === JourneyStage.BUDGET)?.state).toBe('COMPLETED')
    expect(views.find((v) => v.stage === JourneyStage.FINANCING)?.state).toBe('CURRENT')
  })

  it('vergrendelt de volgende fase zolang de huidige verplichte taken heeft', () => {
    const views = viewsFor(JourneyStage.FINANCING, stageTasks(JourneyStage.FINANCING, 2, 0))
    expect(views.find((v) => v.stage === JourneyStage.PROPERTY_SEARCH)?.state).toBe('LOCKED')
  })

  it('ontgrendelt de volgende fase zodra de verplichte taken klaar zijn', () => {
    const views = viewsFor(JourneyStage.FINANCING, stageTasks(JourneyStage.FINANCING, 0, 3))
    expect(views.find((v) => v.stage === JourneyStage.PROPERTY_SEARCH)?.state).toBe('AVAILABLE')
  })

  it('houdt fasen daarna vergrendeld, ook wanneer de huidige klaar is', () => {
    // Eén fase tegelijk: overslaan zou taken stil laten liggen.
    const views = viewsFor(JourneyStage.FINANCING, stageTasks(JourneyStage.FINANCING, 0, 3))
    expect(views.find((v) => v.stage === JourneyStage.VIEWINGS)?.state).toBe('LOCKED')
  })

  it('negeert openstaande optionele taken bij het ontgrendelen', () => {
    const views = viewsFor(JourneyStage.FINANCING, [
      { stage: JourneyStage.FINANCING, status: TaskStatus.COMPLETED, optional: false },
      { stage: JourneyStage.FINANCING, status: TaskStatus.TODO, optional: true },
    ])
    expect(views.find((v) => v.stage === JourneyStage.PROPERTY_SEARCH)?.state).toBe('AVAILABLE')
  })

  it('geeft elke fase terug, in volgorde, met haar positie', () => {
    const views = viewsFor(JourneyStage.ORIENTATION, [])

    expect(views).toHaveLength(STAGE_ORDER.length)
    expect(views.map((v) => v.stage)).toEqual([...STAGE_ORDER])
    expect(views[0]?.position).toBe(1)
    expect(views.at(-1)?.position).toBe(STAGE_ORDER.length)
  })
})

describe('leesbaarheid en uitleg', () => {
  it('laat vooruitlezen toe, ook bij een vergrendelde fase', () => {
    // LOCKED betekent "hier kan je nog niet naartoe", niet "hier mag je niet
    // kijken". Wie wil weten wat hem te wachten staat, moet dat kunnen.
    const views = viewsFor(JourneyStage.BUDGET, stageTasks(JourneyStage.BUDGET, 1, 0))
    expect(views.every((v) => v.readable)).toBe(true)
  })

  it('geeft een reden bij een vergrendelde volgende fase', () => {
    const views = viewsFor(JourneyStage.BUDGET, stageTasks(JourneyStage.BUDGET, 2, 0))
    const next = views.find((v) => v.stage === JourneyStage.FINANCING)

    expect(next?.lockReason).toContain('budget')
  })

  it('geeft geen reden bij een fase die niet vergrendeld is', () => {
    const views = viewsFor(JourneyStage.BUDGET, stageTasks(JourneyStage.BUDGET, 0, 1))
    expect(views.find((v) => v.stage === JourneyStage.BUDGET)?.lockReason).toBeNull()
    expect(views.find((v) => v.stage === JourneyStage.FINANCING)?.lockReason).toBeNull()
  })
})

describe('mag het traject verder', () => {
  it('mag niet met openstaande verplichte taken, en zegt hoeveel', () => {
    const check = canAdvanceStage(
      JourneyStage.FINANCING,
      progressByStage(stageTasks(JourneyStage.FINANCING, 3, 1)),
    )

    expect(check.canAdvance).toBe(false)
    expect(check.blockingTaskCount).toBe(3)
    expect(check.reason).toContain('3 verplichte taken')
  })

  it('mag zodra alle verplichte taken afgehandeld zijn', () => {
    const check = canAdvanceStage(
      JourneyStage.FINANCING,
      progressByStage(stageTasks(JourneyStage.FINANCING, 0, 4)),
    )

    expect(check.canAdvance).toBe(true)
    expect(check.nextStage).toBe(JourneyStage.PROPERTY_SEARCH)
    expect(check.reason).toBeNull()
  })

  it('gebruikt enkelvoud bij één blokkerende taak', () => {
    const check = canAdvanceStage(
      JourneyStage.BUDGET,
      progressByStage(stageTasks(JourneyStage.BUDGET, 1, 0)),
    )
    expect(check.reason).toContain('1 verplichte taak')
  })

  it('kan niet voorbij de laatste fase', () => {
    const check = canAdvanceStage(JourneyStage.COMPLETED, progressByStage([]))
    expect(check.canAdvance).toBe(false)
    expect(check.nextStage).toBeNull()
  })
})

describe('startfase uit het onboarding-doel', () => {
  it('laat wie zich oriënteert bij het begin starten', () => {
    expect(startStageForGoal('ORIENTING')).toBe(JourneyStage.ORIENTATION)
  })

  it('slaat oriëntatie over voor wie klaar is om te kopen', () => {
    expect(startStageForGoal('READY_TO_BUY')).toBe(JourneyStage.BUDGET)
  })

  it('laat wie al een woning heeft toch bij budget starten', () => {
    // Bewust niet bij OFFER: ook wie een woning gevonden heeft, moet zijn
    // budget en financiering nog regelen.
    expect(startStageForGoal('FOUND_PROPERTY')).toBe(JourneyStage.BUDGET)
  })
})

describe('fasen vóór een startfase', () => {
  it('geeft de fasen die overgeslagen worden', () => {
    expect(stagesBefore(JourneyStage.FINANCING)).toEqual([
      JourneyStage.ORIENTATION,
      JourneyStage.BUDGET,
    ])
  })

  it('geeft niets terug voor de eerste fase', () => {
    expect(stagesBefore(JourneyStage.ORIENTATION)).toEqual([])
  })
})
