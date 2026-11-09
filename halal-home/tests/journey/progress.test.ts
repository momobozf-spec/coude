import { describe, expect, it } from 'vitest'
import { JourneyStage, TaskStatus } from '@prisma/client'

import {
  breakdown,
  calculateProgress,
  explainProgress,
  isTaskResolved,
  OPTIONAL_TASK_WEIGHT,
  progressByStage,
  stageBaselinePercentage,
  stageProgressFor,
  weightedPercentage,
  type StageTaskProgressInput,
  type TaskProgressInput,
} from '@/modules/journey/domain/progress'

const tasks = (statuses: TaskStatus[]): TaskProgressInput[] =>
  statuses.map((status) => ({ status }))

const optional = (status: TaskStatus): TaskProgressInput => ({ status, optional: true })
const required = (status: TaskStatus): TaskProgressInput => ({ status, optional: false })

describe('afgehandelde taken', () => {
  it('telt zowel voltooid als overgeslagen als afgehandeld', () => {
    // SKIPPED moet meetellen: wie geen garage heeft en de garage-inspectie
    // overslaat is klaar met die taak. Anders is 100 % onbereikbaar.
    expect(isTaskResolved(TaskStatus.COMPLETED)).toBe(true)
    expect(isTaskResolved(TaskStatus.SKIPPED)).toBe(true)
    expect(isTaskResolved(TaskStatus.TODO)).toBe(false)
    expect(isTaskResolved(TaskStatus.IN_PROGRESS)).toBe(false)
  })
})

describe('opsplitsing', () => {
  it('onderscheidt verplicht, optioneel, voltooid en overgeslagen', () => {
    const stats = breakdown([
      required(TaskStatus.COMPLETED),
      required(TaskStatus.TODO),
      optional(TaskStatus.SKIPPED),
      optional(TaskStatus.TODO),
    ])

    expect(stats).toMatchObject({
      total: 4,
      required: 2,
      optional: 2,
      completed: 1,
      skipped: 1,
      open: 2,
      requiredOpen: 1,
    })
  })

  it('telt alleen verplichte open taken als blokkerend', () => {
    // Optionele taken blokkeren een fase niet — dat is het verschil.
    const stats = breakdown([required(TaskStatus.COMPLETED), optional(TaskStatus.TODO)])
    expect(stats.open).toBe(1)
    expect(stats.requiredOpen).toBe(0)
  })
})

describe('gewogen percentage', () => {
  it('laat een optionele taak lichter wegen dan een verplichte', () => {
    // Een optionele taak afronden levert wel iets op, maar minder.
    const eenOptioneel = weightedPercentage([
      optional(TaskStatus.COMPLETED),
      required(TaskStatus.TODO),
    ])
    const eenVerplicht = weightedPercentage([
      optional(TaskStatus.TODO),
      required(TaskStatus.COMPLETED),
    ])

    expect(eenOptioneel).toBeLessThan(eenVerplicht)
    // 0,4 van totaal 1,4 = 29 %.
    expect(eenOptioneel).toBe(Math.round((OPTIONAL_TASK_WEIGHT / 1.4) * 100))
  })

  it('geeft 100 wanneer alles afgehandeld is', () => {
    expect(
      weightedPercentage([optional(TaskStatus.SKIPPED), required(TaskStatus.COMPLETED)]),
    ).toBe(100)
  })

  it('geeft 0 zonder taken', () => {
    expect(weightedPercentage([])).toBe(0)
  })

  it('maakt 100 % bereikbaar door optionele taken over te slaan', () => {
    // Dit is de reden dat SKIPPED meetelt: anders blijft de balk hangen op een
    // taak die de gebruiker terecht niet doet.
    expect(
      weightedPercentage([required(TaskStatus.COMPLETED), optional(TaskStatus.SKIPPED)]),
    ).toBe(100)
  })
})

describe('voortgang van het traject', () => {
  it('is 100 % zodra het traject afgerond is, ongeacht openstaande taken', () => {
    expect(calculateProgress(JourneyStage.COMPLETED, tasks([TaskStatus.TODO]))).toBe(100)
  })

  it('valt terug op de fase wanneer er nog geen taken zijn', () => {
    const stage = JourneyStage.FINANCING
    expect(calculateProgress(stage, [])).toBe(stageBaselinePercentage(stage))
  })

  it('daalt nooit onder de ondergrens van de fase', () => {
    // Anders zou vooruitgaan naar een fase met veel nieuwe open taken de balk
    // laten zakken, en dat voelt als straf voor vooruitgang.
    const stage = JourneyStage.NOTARY
    const allOpen = tasks(Array(10).fill(TaskStatus.TODO))
    expect(calculateProgress(stage, allOpen)).toBeGreaterThanOrEqual(
      stageBaselinePercentage(stage),
    )
  })

  it('stijgt naarmate er meer taken afgerond zijn', () => {
    const stage = JourneyStage.FINANCING
    const none = calculateProgress(stage, tasks(Array(4).fill(TaskStatus.TODO)))
    const half = calculateProgress(
      stage,
      tasks([TaskStatus.COMPLETED, TaskStatus.COMPLETED, TaskStatus.TODO, TaskStatus.TODO]),
    )
    const all = calculateProgress(stage, tasks(Array(4).fill(TaskStatus.COMPLETED)))

    expect(half).toBeGreaterThanOrEqual(none)
    expect(all).toBeGreaterThan(half)
  })

  it('blijft binnen 0 en 100', () => {
    for (const stage of Object.values(JourneyStage)) {
      for (const statuses of [[], [TaskStatus.TODO], [TaskStatus.COMPLETED]]) {
        const value = calculateProgress(stage, tasks(statuses))
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })

  it('geeft een ondergrens van 0 voor de eerste fase en 100 voor de laatste', () => {
    expect(stageBaselinePercentage(JourneyStage.ORIENTATION)).toBe(0)
    expect(stageBaselinePercentage(JourneyStage.COMPLETED)).toBe(100)
  })
})

describe('uitleg bij het percentage', () => {
  it('legt uit hoeveel taken afgehandeld zijn', () => {
    // Een gebruiker moet kunnen begrijpen waarom hij op 37 % staat.
    const explanation = explainProgress(JourneyStage.FINANCING, [
      required(TaskStatus.COMPLETED),
      required(TaskStatus.TODO),
    ])

    expect(explanation.lines.join(' ')).toContain('1 van 2 taken')
    expect(explanation.percentage).toBe(
      calculateProgress(JourneyStage.FINANCING, [
        required(TaskStatus.COMPLETED),
        required(TaskStatus.TODO),
      ]),
    )
  })

  it('vermeldt het gewicht van optionele taken wanneer die er zijn', () => {
    const explanation = explainProgress(JourneyStage.BUDGET, [
      required(TaskStatus.COMPLETED),
      optional(TaskStatus.TODO),
    ])
    expect(explanation.lines.join(' ')).toContain(String(OPTIONAL_TASK_WEIGHT))
  })

  it('vermeldt de fase-ondergrens wanneer die het percentage bepaalt', () => {
    const explanation = explainProgress(JourneyStage.NOTARY, [required(TaskStatus.TODO)])
    expect(explanation.baselineApplied).toBe(true)
    expect(explanation.lines.join(' ')).toContain('zakt niet onder')
  })

  it('noemt hoeveel verplichte taken de fase nog blokkeren', () => {
    const explanation = explainProgress(JourneyStage.FINANCING, [
      required(TaskStatus.TODO),
      required(TaskStatus.TODO),
    ])
    expect(explanation.lines.join(' ')).toContain('2 verplichte taken')
  })

  it('legt een afgerond traject in één zin uit', () => {
    const explanation = explainProgress(JourneyStage.COMPLETED, [required(TaskStatus.TODO)])
    expect(explanation.percentage).toBe(100)
    expect(explanation.lines).toHaveLength(1)
  })

  it('legt een leeg traject uit zonder te doen alsof er taken zijn', () => {
    const explanation = explainProgress(JourneyStage.ORIENTATION, [])
    expect(explanation.lines.join(' ')).toContain('nog geen taken')
  })
})

describe('voortgang per fase', () => {
  const stageTasks: StageTaskProgressInput[] = [
    { stage: JourneyStage.BUDGET, status: TaskStatus.COMPLETED },
    { stage: JourneyStage.BUDGET, status: TaskStatus.TODO },
    { stage: JourneyStage.FINANCING, status: TaskStatus.COMPLETED },
    { stage: JourneyStage.FINANCING, status: TaskStatus.TODO, optional: true },
  ]

  it('rekent per fase apart', () => {
    const result = progressByStage(stageTasks)

    expect(result.find((r) => r.stage === JourneyStage.BUDGET)).toMatchObject({
      percentage: 50,
      requiredComplete: false,
    })
    // Financiering: één verplichte af, één optionele open → alle verplichte af.
    expect(result.find((r) => r.stage === JourneyStage.FINANCING)).toMatchObject({
      requiredComplete: true,
    })
  })

  it('geeft elke fase uit de volgorde terug, ook zonder taken', () => {
    const result = progressByStage(stageTasks)
    expect(result).toHaveLength(Object.values(JourneyStage).length)
    expect(result.find((r) => r.stage === JourneyStage.MOVING)?.breakdown.total).toBe(0)
  })

  it('geeft een label mee voor de tijdlijn', () => {
    expect(progressByStage([])[0]?.label).toBeTruthy()
  })

  it('haalt één fase eruit', () => {
    expect(stageProgressFor(JourneyStage.BUDGET, stageTasks).percentage).toBe(50)
  })
})
