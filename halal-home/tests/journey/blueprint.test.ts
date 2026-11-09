import { describe, expect, it } from 'vitest'
import { JourneyStage, TaskStatus } from '@prisma/client'

import {
  allDependencyKeys,
  BE_BLUEPRINT_V1,
  BlueprintNotFoundError,
  CURRENT_BLUEPRINT_VERSION,
  blueprintKeysForStage,
  blueprintTasksFor,
  findBlueprintTask,
  getBlueprint,
} from '@/modules/journey/domain/blueprint'
import { hasCycle } from '@/modules/journey/domain/dependencies'
import { STAGE_ORDER, stageIndex } from '@/modules/journey/domain/stages'

const ALL = blueprintTasksFor({ country: 'BE', firstHome: true })

describe('stabiele identifiers', () => {
  it('gebruikt UPPER_SNAKE_CASE voor elke sleutel', () => {
    // Migraties, analytics, aanbevelingen en blauwdruk-upgrades verwijzen naar
    // deze sleutel. Een database-id kan dat niet: die verschilt per gebruiker.
    for (const task of ALL) {
      expect(task.key, task.key).toMatch(/^[A-Z][A-Z0-9_]*$/)
    }
  })

  it('heeft unieke sleutels', () => {
    const keys = ALL.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('laat de sleutel beginnen met de fase waartoe hij hoort', () => {
    // Zo is aan de sleutel alleen al te zien waar een taak thuishoort.
    const prefixes: Record<string, string> = {
      ORIENTATION: 'ORIENTATION',
      BUDGET: 'BUDGET',
      FINANCING: 'FINANCING',
      PROPERTY_SEARCH: 'SEARCH',
      VIEWINGS: 'VIEWINGS',
      OFFER: 'OFFER',
      AGREEMENT: 'AGREEMENT',
      NOTARY: 'NOTARY',
      INSURANCE_ADMIN: 'ADMIN',
      MOVING: 'MOVING',
    }

    for (const task of ALL) {
      const expected = prefixes[task.stage]
      if (!expected) continue
      expect(task.key.startsWith(`${expected}_`), `${task.key} hoort bij ${task.stage}`).toBe(true)
    }
  })

  it('vindt een taak op zijn sleutel', () => {
    const task = findBlueprintTask('FINANCING_COMPARE_OPTIONS', {
      country: 'BE',
      firstHome: true,
    })
    expect(task?.stage).toBe(JourneyStage.FINANCING)
  })
})

describe('samenhang van de blauwdruk', () => {
  it('verwijst nooit naar een niet-bestaande sleutel', () => {
    const keys = new Set(ALL.map((t) => t.key))
    for (const task of ALL) {
      for (const dependency of allDependencyKeys(task)) {
        expect(keys, `${task.key} verwijst naar ${dependency}`).toContain(dependency)
      }
    }
  })

  it('bevat geen cyclus', () => {
    // Een cyclus zou elke betrokken taak permanent blokkeren, en valt pas
    // maanden later op bij een gebruiker die vastloopt.
    const nodes = ALL.map((task) => ({
      id: task.key,
      title: task.title,
      status: TaskStatus.TODO,
      dependsOn: allDependencyKeys(task),
    }))
    expect(hasCycle(nodes)).toBe(false)
  })

  it('laat een taak nooit afhangen van een latere fase', () => {
    // Anders is een taak onbereikbaar: de fase waarin hij staat komt eerder dan
    // de fase waarop hij wacht.
    const byKey = new Map(ALL.map((t) => [t.key, t]))

    for (const task of ALL) {
      for (const dependencyKey of allDependencyKeys(task)) {
        const dependency = byKey.get(dependencyKey)
        if (!dependency) continue

        expect(
          stageIndex(dependency.stage),
          `${task.key} (${task.stage}) hangt af van ${dependencyKey} (${dependency.stage})`,
        ).toBeLessThanOrEqual(stageIndex(task.stage))
      }
    }
  })

  it('heeft in elke fase behalve de laatste minstens één taak', () => {
    for (const stage of STAGE_ORDER) {
      if (stage === JourneyStage.COMPLETED) continue
      expect(
        blueprintKeysForStage(stage, { country: 'BE', firstHome: true }).length,
        `fase ${stage} heeft geen taken`,
      ).toBeGreaterThan(0)
    }
  })

  it('heeft in elke fase minstens één verplichte taak', () => {
    // Een fase met alleen optionele taken zou meteen doorschuiven en zo
    // onzichtbaar blijven voor de gebruiker.
    for (const stage of STAGE_ORDER) {
      if (stage === JourneyStage.COMPLETED) continue
      const inStage = ALL.filter((t) => t.stage === stage)
      expect(
        inStage.some((t) => !t.optional),
        `fase ${stage} heeft alleen optionele taken`,
      ).toBe(true)
    }
  })

  it('legt de kritieke afhankelijkheid vast: bieden pas na financieringsbewijs', () => {
    // Dit is de fout die het platform hoort te voorkomen.
    const offer = findBlueprintTask('OFFER_CONFIRM_FINANCING', {
      country: 'BE',
      firstHome: true,
    })
    // En wel als BLOKKERENDE afhankelijkheid: een adviserende volgorde zou
    // het bod niet tegenhouden, en juist dat is hier het punt.
    expect(offer?.blockedBy).toContain('FINANCING_OBTAIN_PROOF')
    expect(offer?.dependsOn ?? []).not.toContain('FINANCING_OBTAIN_PROOF')
  })
})

describe('versiebeheer', () => {
  it('geeft de huidige versie voor nieuwe trajecten', () => {
    expect(getBlueprint('BE').version).toBe(CURRENT_BLUEPRINT_VERSION)
  })

  it('geeft een specifieke versie terug wanneer die gevraagd wordt', () => {
    expect(getBlueprint('BE', 1)).toBe(BE_BLUEPRINT_V1)
  })

  it('gooit bij een onbekende versie in plaats van stil terug te vallen', () => {
    // Stil terugvallen zou betekenen dat een bestaand traject een andere
    // takenlijst krijgt dan waarmee het is opgezet — precies wat versiebeheer
    // moet voorkomen.
    expect(() => getBlueprint('BE', 99)).toThrow(BlueprintNotFoundError)
  })

  it('valt bij een onbekend land wél terug op België', () => {
    // Een gebruiker met een afwijkend profiel hoort wél een traject te krijgen.
    expect(getBlueprint('XX').country).toBe('BE')
  })
})

describe('filters', () => {
  it('geeft dezelfde taken voor een eerste en een volgende woning zolang er geen firstHomeOnly is', () => {
    const first = blueprintTasksFor({ country: 'BE', firstHome: true })
    const second = blueprintTasksFor({ country: 'BE', firstHome: false })
    const onlyFirstHome = first.filter((t) => t.firstHomeOnly)

    expect(second).toHaveLength(first.length - onlyFirstHome.length)
  })

  it('geeft de sleutels van één fase in volgorde', () => {
    const keys = blueprintKeysForStage(JourneyStage.BUDGET, { country: 'BE', firstHome: true })
    expect(keys).toEqual([
      'BUDGET_SET_OWN_FUNDS',
      'BUDGET_ESTIMATE_COSTS',
      'BUDGET_SET_MAX_PRICE',
    ])
  })
})
