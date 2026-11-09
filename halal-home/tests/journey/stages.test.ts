import { describe, expect, it } from 'vitest'
import { JourneyStage } from '@prisma/client'

import {
  STAGE_META,
  STAGE_ORDER,
  canTransition,
  isAfter,
  isAtOrAfter,
  nextStage,
  previousStage,
  stageIndex,
} from '@/modules/journey/domain/stages'

describe('fasevolgorde', () => {
  it('bevat elke fase uit het Prisma-enum precies één keer', () => {
    // Deze test is de reden dat STAGE_ORDER een eigen array is: hij bewaakt dat
    // schema en domeinlogica niet uit elkaar lopen wanneer iemand een fase
    // toevoegt.
    const fromPrisma = Object.values(JourneyStage)
    expect([...STAGE_ORDER].sort()).toEqual([...fromPrisma].sort())
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length)
  })

  it('heeft voor elke fase een label, beschrijving en focus', () => {
    for (const stage of STAGE_ORDER) {
      const meta = STAGE_META[stage]
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
      expect(meta.focus.length).toBeGreaterThan(0)
    }
  })

  it('begint bij oriëntatie en eindigt bij afgerond', () => {
    expect(STAGE_ORDER[0]).toBe(JourneyStage.ORIENTATION)
    expect(STAGE_ORDER.at(-1)).toBe(JourneyStage.COMPLETED)
  })

  it('gooit bij een onbekende fase in plaats van -1 terug te geven', () => {
    expect(() => stageIndex('NIET_BESTAAND' as JourneyStage)).toThrow()
  })
})

describe('navigatie tussen fasen', () => {
  it('geeft de volgende en vorige fase', () => {
    expect(nextStage(JourneyStage.BUDGET)).toBe(JourneyStage.FINANCING)
    expect(previousStage(JourneyStage.FINANCING)).toBe(JourneyStage.BUDGET)
  })

  it('geeft null aan de uiteinden', () => {
    expect(nextStage(JourneyStage.COMPLETED)).toBeNull()
    expect(previousStage(JourneyStage.ORIENTATION)).toBeNull()
  })

  it('vergelijkt fasen op volgorde', () => {
    expect(isAfter(JourneyStage.NOTARY, JourneyStage.OFFER)).toBe(true)
    expect(isAfter(JourneyStage.OFFER, JourneyStage.NOTARY)).toBe(false)
    expect(isAtOrAfter(JourneyStage.OFFER, JourneyStage.OFFER)).toBe(true)
    expect(isAfter(JourneyStage.OFFER, JourneyStage.OFFER)).toBe(false)
  })
})

describe('fase-overgangen', () => {
  it('staat één stap vooruit toe', () => {
    expect(canTransition(JourneyStage.BUDGET, JourneyStage.FINANCING)).toBe(true)
  })

  it('weigert het overslaan van een fase', () => {
    // Overslaan zou taken en documenten stil laten liggen die de volgende fase
    // nodig heeft; de gebruiker komt er dan pas bij de notaris achter.
    expect(canTransition(JourneyStage.BUDGET, JourneyStage.OFFER)).toBe(false)
    expect(canTransition(JourneyStage.ORIENTATION, JourneyStage.COMPLETED)).toBe(false)
  })

  it('staat elke stap achteruit toe, ook meerdere tegelijk', () => {
    // Een afgeketste financiering is een normale gebeurtenis, geen fout.
    expect(canTransition(JourneyStage.OFFER, JourneyStage.FINANCING)).toBe(true)
    expect(canTransition(JourneyStage.NOTARY, JourneyStage.ORIENTATION)).toBe(true)
  })

  it('weigert een overgang naar dezelfde fase', () => {
    expect(canTransition(JourneyStage.OFFER, JourneyStage.OFFER)).toBe(false)
  })
})
