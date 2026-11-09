import { describe, expect, it } from 'vitest'
import { DocumentCategory, JourneyStage, TaskStatus } from '@prisma/client'

import {
  buildRecommendations,
  MAX_RECOMMENDATIONS,
  nextBestAction,
  type RecommendationContext,
} from '@/modules/journey/domain/recommendations'

const NOW = new Date('2026-08-07T12:00:00.000Z')
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000)

const context = (overrides: Partial<RecommendationContext> = {}): RecommendationContext => ({
  journeyId: 'j1',
  stage: JourneyStage.FINANCING,
  targetBudgetCents: 450_000_00,
  ownContributionCents: 90_000_00,
  needsFinancing: true,
  documentCategories: [DocumentCategory.IDENTITY, DocumentCategory.INCOME],
  savedPropertyCount: 4,
  activeSearchCount: 1,
  tasks: [],
  events: [],
  hasFinancingQuote: true,
  hasNeighborhoodPreference: true,
  now: NOW,
  ...overrides,
})

const keys = (ctx: RecommendationContext, limit = MAX_RECOMMENDATIONS) =>
  buildRecommendations(ctx, limit).map((r) => r.key)

describe('ontbrekende documenten', () => {
  it('vraagt om inkomensdocumenten in de financieringsfase', () => {
    const result = keys(context({ documentCategories: [DocumentCategory.IDENTITY] }))
    expect(result).toContain('financing.income_documents_missing')
  })

  it('vraagt er niet om zodra ze er zijn', () => {
    expect(keys(context())).not.toContain('financing.income_documents_missing')
  })

  it('vraagt er niet om vóór de financieringsfase', () => {
    // Iemand die nog aan het oriënteren is, hoeft nog geen loonfiches te uploaden.
    const result = keys(context({ stage: JourneyStage.ORIENTATION, documentCategories: [] }))
    expect(result).not.toContain('financing.income_documents_missing')
  })

  it('waarschuwt bij een bod zonder financieringsbewijs', () => {
    const result = keys(
      context({
        stage: JourneyStage.OFFER,
        documentCategories: [DocumentCategory.IDENTITY, DocumentCategory.INCOME],
      }),
    )
    expect(result).toContain('offer.no_financing_proof')
  })

  it('geeft de waarschuwing over een bod de hoogste urgentie', () => {
    const found = buildRecommendations(
      context({ stage: JourneyStage.OFFER, documentCategories: [] }),
    ).find((r) => r.key === 'offer.no_financing_proof')

    expect(found?.severity).toBe('critical')
  })
})

describe('budget', () => {
  it('vraagt eerst om eigen middelen, daarna pas om het budget', () => {
    // De volgorde is inhoudelijk: je eigen inbreng bepaalt wat je kan besteden.
    const zonderBeide = keys(
      context({ targetBudgetCents: null, ownContributionCents: null }),
    )
    expect(zonderBeide).toContain('budget.own_contribution_missing')
    expect(zonderBeide).not.toContain('budget.missing')

    const metEigenMiddelen = keys(context({ targetBudgetCents: null }))
    expect(metEigenMiddelen).toContain('budget.missing')
  })

  it('vraagt om een kostenraming zodra het budget vaststaat', () => {
    const result = keys(
      context({
        stage: JourneyStage.BUDGET,
        tasks: [
          {
            id: 't1',
            templateKey: 'BUDGET_ESTIMATE_COSTS',
            title: 'Kosten berekenen',
            status: TaskStatus.TODO,
            dueDate: null,
          },
        ],
      }),
    )
    expect(result).toContain('budget.costs_not_estimated')
  })

  it('vraagt er niet meer om zodra die taak af is', () => {
    const result = keys(
      context({
        stage: JourneyStage.BUDGET,
        tasks: [
          {
            id: 't1',
            templateKey: 'BUDGET_ESTIMATE_COSTS',
            title: 'Kosten berekenen',
            status: TaskStatus.COMPLETED,
            dueDate: null,
          },
        ],
      }),
    )
    expect(result).not.toContain('budget.costs_not_estimated')
  })

  it('vraagt er niet om wanneer die taak helemaal niet bestaat', () => {
    // Een regel mag alleen afgaan op positief bewijs. Afwezigheid behandelen
    // als "niet gedaan" geeft een aanmaning voor werk waarvan we niet weten of
    // het bestaat — precies het soort onterechte melding dat mensen een
    // dashboard doet negeren.
    const result = keys(context({ stage: JourneyStage.BUDGET, tasks: [] }))
    expect(result).not.toContain('budget.costs_not_estimated')
  })
})

describe('financiering', () => {
  it('stelt vergelijken voor wanneer er nog geen berekening is', () => {
    expect(keys(context({ hasFinancingQuote: false }))).toContain('financing.no_comparison')
  })

  it('stelt het niet voor wanneer de gebruiker geen financiering nodig heeft', () => {
    // needsFinancing === false is een expliciet antwoord; null (onzeker) niet.
    const result = keys(context({ hasFinancingQuote: false, needsFinancing: false }))
    expect(result).not.toContain('financing.no_comparison')
  })

  it('stelt het wél voor wanneer de gebruiker het nog niet weet', () => {
    const result = keys(context({ hasFinancingQuote: false, needsFinancing: null }))
    expect(result).toContain('financing.no_comparison')
  })
})

describe('waarom nu', () => {
  it('geeft elke aanbeveling een reden', () => {
    // Zonder reden is een aanbeveling een mening van de app in plaats van een
    // gevolgtrekking die de gebruiker kan controleren.
    const all = buildRecommendations(
      context({
        stage: JourneyStage.NOTARY,
        documentCategories: [],
        targetBudgetCents: null,
        ownContributionCents: null,
        hasFinancingQuote: false,
        hasNeighborhoodPreference: false,
      }),
    )

    expect(all.length).toBeGreaterThan(0)
    for (const recommendation of all) {
      expect(recommendation.reason.length).toBeGreaterThan(0)
      expect(recommendation.effort).toBeTruthy()
    }
  })

  it('noemt het budget in de reden wanneer dat is ingevuld', () => {
    const found = buildRecommendations(context({ hasFinancingQuote: false })).find(
      (r) => r.key === 'financing.no_comparison',
    )
    expect(found?.reason).toContain('budget')
  })
})

describe('deadlines', () => {
  const task = (overrides: Partial<RecommendationContext['tasks'][number]> = {}) => ({
    id: 't1',
    templateKey: null,
    title: 'Documenten indienen',
    status: TaskStatus.TODO,
    dueDate: inDays(3),
    ...overrides,
  })

  it('meldt een taak die binnenkort verloopt', () => {
    const found = buildRecommendations(context({ tasks: [task()] })).find(
      (r) => r.key === 'deadline.task.t1',
    )
    expect(found?.body).toContain('3 dag')
  })

  it('markeert een verstreken deadline als kritiek', () => {
    const found = buildRecommendations(
      context({ tasks: [task({ dueDate: inDays(-2) })] }),
    ).find((r) => r.key === 'deadline.task.t1')

    expect(found?.severity).toBe('critical')
    expect(found?.title).toContain('Verstreken')
  })

  it('meldt een deadline die nog ver weg is niet', () => {
    expect(keys(context({ tasks: [task({ dueDate: inDays(30) })] }))).not.toContain(
      'deadline.task.t1',
    )
  })

  it('meldt een afgeronde taak niet, ook niet met een verstreken datum', () => {
    const result = keys(
      context({ tasks: [task({ status: TaskStatus.COMPLETED, dueDate: inDays(-5) })] }),
    )
    expect(result).not.toContain('deadline.task.t1')
  })

  it('meldt een aankomende afspraak', () => {
    const found = buildRecommendations(
      context({ events: [{ id: 'e1', title: 'Bezichtiging Gent', startsAt: inDays(1), dueAt: null }] }),
    ).find((r) => r.key === 'deadline.event.e1')

    expect(found?.body).toBe('Morgen.')
  })
})

describe('sortering en limiet', () => {
  const busy = () =>
    context({
      stage: JourneyStage.NOTARY,
      documentCategories: [],
      targetBudgetCents: null,
      ownContributionCents: null,
      activeSearchCount: 0,
      savedPropertyCount: 0,
      hasFinancingQuote: false,
      hasNeighborhoodPreference: false,
    })

  it('zet de meest urgente aanbevelingen bovenaan', () => {
    const severities = buildRecommendations(busy()).map((r) => r.severity)
    const order = { critical: 0, important: 1, suggestion: 2 }
    expect(severities).toEqual([...severities].sort((a, b) => order[a] - order[b]))
  })

  it('toont er nooit meer dan het maximum, ook niet bij een hogere limiet', () => {
    // Vijftien openstaande punten wordt behang; dan kijkt de gebruiker eroverheen.
    expect(buildRecommendations(busy(), 99)).toHaveLength(MAX_RECOMMENDATIONS)
  })

  it('respecteert een lagere limiet', () => {
    expect(buildRecommendations(busy(), 3)).toHaveLength(3)
  })

  it('geeft niets terug wanneer alles op orde is', () => {
    const result = buildRecommendations(
      context({
        stage: JourneyStage.PROPERTY_SEARCH,
        documentCategories: [
          DocumentCategory.IDENTITY,
          DocumentCategory.INCOME,
          DocumentCategory.BANK,
        ],
      }),
    )
    expect(result).toHaveLength(0)
  })

  it('geeft elke aanbeveling een unieke sleutel', () => {
    const result = keys(busy())
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('volgende stap', () => {
  it('is de meest urgente aanbeveling', () => {
    const ctx = context({ stage: JourneyStage.OFFER, documentCategories: [] })
    // Eén bron voor "wat moet ik nu doen": twee losse berekeningen zouden uit
    // de pas kunnen lopen.
    expect(nextBestAction(ctx)?.key).toBe(buildRecommendations(ctx)[0]?.key)
  })

  it('is null wanneer er niets te doen is', () => {
    expect(
      nextBestAction(
        context({
          stage: JourneyStage.PROPERTY_SEARCH,
          documentCategories: [
            DocumentCategory.IDENTITY,
            DocumentCategory.INCOME,
            DocumentCategory.BANK,
          ],
        }),
      ),
    ).toBeNull()
  })
})
