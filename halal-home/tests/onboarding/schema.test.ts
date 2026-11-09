import { describe, expect, it } from 'vitest'
import { OnboardingGoal, PurchaseTimeline, PurchaseType } from '@prisma/client'

import {
  budgetStepSchema,
  firstIncompleteStep,
  goalStepSchema,
  isDraftComplete,
  locationStepSchema,
  ONBOARDING_STEPS,
  onboardingDraftSchema,
  prioritiesStepSchema,
  stepDefinition,
  targetDateFor,
  timingStepSchema,
  TOTAL_ONBOARDING_STEPS,
  type OnboardingDraft,
} from '@/modules/onboarding/schema'

const completeDraft: OnboardingDraft = {
  goal: OnboardingGoal.READY_TO_BUY,
  country: 'BE',
  region: 'FLANDERS',
  city: 'Gent',
  maxBudgetCents: 450_000_00,
  ownFundsCents: 90_000_00,
  needsFinancing: true,
  timeline: PurchaseTimeline.WITHIN_6_MONTHS,
  priorities: ['mosque_nearby'],
}

describe('stappen', () => {
  it('heeft vijf stappen, opeenvolgend genummerd', () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(5)
    expect(ONBOARDING_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5])
  })

  it('vindt een stap op nummer', () => {
    expect(stepDefinition(3)?.key).toBe('budget')
    expect(stepDefinition(99)).toBeNull()
  })
})

describe('stap 1 — doel', () => {
  it('accepteert elk geldig doel', () => {
    for (const goal of Object.values(OnboardingGoal)) {
      expect(goalStepSchema.safeParse({ goal }).success).toBe(true)
    }
  })

  it('weigert een onbekend doel', () => {
    expect(goalStepSchema.safeParse({ goal: 'MISSCHIEN' }).success).toBe(false)
  })
})

describe('stap 2 — locatie', () => {
  it('accepteert een gewest en gemeente', () => {
    const parsed = locationStepSchema.parse({ region: 'FLANDERS', city: 'Gent' })
    expect(parsed.country).toBe('BE')
  })

  it('weigert een ontbrekende gemeente', () => {
    expect(locationStepSchema.safeParse({ region: 'FLANDERS', city: '' }).success).toBe(false)
  })

  it('weigert een postcode die geen vier cijfers is', () => {
    expect(
      locationStepSchema.safeParse({ region: 'FLANDERS', city: 'Gent', postalCode: '90000' })
        .success,
    ).toBe(false)
  })

  it('behandelt een lege postcode als niet ingevuld', () => {
    // Het formulier stuurt een leeg veld mee; dat is geen fout.
    const parsed = locationStepSchema.parse({
      region: 'FLANDERS',
      city: 'Gent',
      postalCode: '',
    })
    expect(parsed.postalCode).toBeUndefined()
  })

  it('weigert een gewest dat niet bestaat', () => {
    expect(locationStepSchema.safeParse({ region: 'LIMBURG', city: 'Hasselt' }).success).toBe(
      false,
    )
  })
})

describe('stap 3 — budget', () => {
  const valid = {
    maxBudgetCents: 450_000_00,
    ownFundsCents: 90_000_00,
    needsFinancing: true,
  }

  it('accepteert een normale invoer', () => {
    const parsed = budgetStepSchema.parse(valid)
    expect(parsed.purchaseType).toBe(PurchaseType.EXISTING)
    expect(parsed.firstHome).toBe(true)
  })

  it('weigert eigen middelen boven het budget', () => {
    const result = budgetStepSchema.safeParse({
      ...valid,
      ownFundsCents: 500_000_00,
    })
    expect(result.success).toBe(false)
  })

  it('weigert financiering wanneer eigen middelen de hele aankoop dekken', () => {
    // Anders krijgt de gebruiker een traject dat om documenten vraagt die
    // nergens voor dienen.
    const result = budgetStepSchema.safeParse({
      maxBudgetCents: 300_000_00,
      ownFundsCents: 300_000_00,
      needsFinancing: true,
    })
    expect(result.success).toBe(false)
  })

  it('staat een volledige eigen financiering wél toe wanneer needsFinancing false is', () => {
    const result = budgetStepSchema.safeParse({
      maxBudgetCents: 300_000_00,
      ownFundsCents: 300_000_00,
      needsFinancing: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepteert onzeker als antwoord op de financieringsvraag', () => {
    // null is iets anders dan nee.
    const parsed = budgetStepSchema.parse({ ...valid, needsFinancing: null })
    expect(parsed.needsFinancing).toBeNull()
  })

  it('weigert negatieve bedragen', () => {
    expect(budgetStepSchema.safeParse({ ...valid, ownFundsCents: -1 }).success).toBe(false)
  })
})

describe('stap 4 — timing', () => {
  it('accepteert elke termijn', () => {
    for (const timeline of Object.values(PurchaseTimeline)) {
      expect(timingStepSchema.safeParse({ timeline }).success).toBe(true)
    }
  })

  it('leidt een streefdatum af uit de termijn', () => {
    const from = new Date('2026-01-15T00:00:00.000Z')
    const target = targetDateFor(PurchaseTimeline.WITHIN_6_MONTHS, from)

    expect(target?.getUTCMonth()).toBe(6) // juli
    expect(target?.getUTCFullYear()).toBe(2026)
  })

  it('geeft geen streefdatum zonder deadline', () => {
    expect(targetDateFor(PurchaseTimeline.NO_DEADLINE, new Date())).toBeNull()
  })
})

describe('stap 5 — prioriteiten', () => {
  it('accepteert een lege keuze', () => {
    expect(prioritiesStepSchema.parse({}).priorities).toEqual([])
  })

  it('weigert een onbekende prioriteit', () => {
    expect(prioritiesStepSchema.safeParse({ priorities: ['zwembad'] }).success).toBe(false)
  })

  it('accepteert meerdere prioriteiten', () => {
    const parsed = prioritiesStepSchema.parse({
      priorities: ['mosque_nearby', 'halal_financing'],
    })
    expect(parsed.priorities).toHaveLength(2)
  })
})

describe('het concept', () => {
  it('accepteert een half ingevuld document', () => {
    // Een halve onboarding is een geldige toestand: dat is wat hervatten
    // mogelijk maakt.
    expect(onboardingDraftSchema.safeParse({ goal: OnboardingGoal.ORIENTING }).success).toBe(true)
    expect(onboardingDraftSchema.safeParse({}).success).toBe(true)
  })

  it('herkent een compleet concept', () => {
    expect(isDraftComplete(completeDraft)).toBe(true)
  })

  it('vindt prioriteiten niet nodig om compleet te zijn', () => {
    // Een verrijking, geen voorwaarde.
    const { priorities: _omitted, ...zonder } = completeDraft
    expect(isDraftComplete(zonder)).toBe(true)
  })

  it('herkent een onvolledig concept', () => {
    const { maxBudgetCents: _omitted, ...zonderBudget } = completeDraft
    expect(isDraftComplete(zonderBudget)).toBe(false)
  })
})

describe('hervatten', () => {
  it('wijst naar stap 1 bij een leeg concept', () => {
    expect(firstIncompleteStep({})).toBe(1)
  })

  it('wijst naar de eerste ontbrekende stap', () => {
    expect(firstIncompleteStep({ goal: OnboardingGoal.ORIENTING })).toBe(2)
    expect(firstIncompleteStep({ goal: OnboardingGoal.ORIENTING, region: 'FLANDERS' })).toBe(2)
    expect(
      firstIncompleteStep({
        goal: OnboardingGoal.ORIENTING,
        region: 'FLANDERS',
        city: 'Gent',
      }),
    ).toBe(3)
  })

  it('wijst voorbij de laatste stap wanneer alles ingevuld is', () => {
    expect(firstIncompleteStep(completeDraft)).toBe(TOTAL_ONBOARDING_STEPS + 1)
  })

  it('vraagt nog om prioriteiten wanneer de rest klaar is', () => {
    const { priorities: _omitted, ...zonder } = completeDraft
    expect(firstIncompleteStep(zonder)).toBe(5)
  })
})
