import { describe, expect, it } from 'vitest'
import {
  ChecklistImportance,
  ChecklistScope,
  FinancingType,
  JourneyStage,
  PurchaseType,
} from '@prisma/client'

import {
  selectTemplates,
  templateApplies,
  type ChecklistContext,
  type SelectableTemplate,
} from '@/modules/checklist/domain/selection'
import {
  CHECKLIST_DISCLAIMER,
  checklistProgress,
  isItemResolved,
} from '@/modules/checklist/domain/progress'

const template = (overrides: Partial<SelectableTemplate> = {}): SelectableTemplate => ({
  id: 't1',
  key: 'be.notary',
  scope: ChecklistScope.NOTARY,
  country: 'BE',
  region: null,
  stage: null,
  purchaseType: null,
  financingType: null,
  firstHomeOnly: false,
  active: true,
  validFrom: null,
  validUntil: null,
  sortOrder: 10,
  version: 1,
  ...overrides,
})

const context = (overrides: Partial<ChecklistContext> = {}): ChecklistContext => ({
  country: 'BE',
  region: 'FLANDERS',
  firstHome: true,
  ...overrides,
})

describe('is een template van toepassing', () => {
  it('geldt wanneer alle criteria leeg zijn', () => {
    expect(templateApplies(template(), context())).toBe(true)
  })

  it('geldt niet voor een ander land', () => {
    expect(templateApplies(template({ country: 'NL' }), context())).toBe(false)
  })

  it('geldt landelijk wanneer er geen gewest is opgegeven', () => {
    // Zo kan een landelijke lijst bestaan zonder kopie per gewest.
    expect(templateApplies(template({ region: null }), context({ region: 'BRUSSELS' }))).toBe(
      true,
    )
  })

  it('geldt niet voor een ander gewest', () => {
    expect(
      templateApplies(template({ region: 'BRUSSELS' }), context({ region: 'FLANDERS' })),
    ).toBe(false)
  })

  it('geldt niet wanneer hij niet actief is', () => {
    expect(templateApplies(template({ active: false }), context())).toBe(false)
  })

  it('geldt alleen voor een eerste woning wanneer dat zo is ingesteld', () => {
    const onlyFirst = template({ firstHomeOnly: true })
    expect(templateApplies(onlyFirst, context({ firstHome: true }))).toBe(true)
    expect(templateApplies(onlyFirst, context({ firstHome: false }))).toBe(false)
  })

  it('filtert op aankooptype wanneer beide dat noemen', () => {
    const newBuild = template({ purchaseType: PurchaseType.NEW_BUILD })
    expect(templateApplies(newBuild, context({ purchaseType: PurchaseType.NEW_BUILD }))).toBe(
      true,
    )
    expect(templateApplies(newBuild, context({ purchaseType: PurchaseType.EXISTING }))).toBe(
      false,
    )
  })

  it('filtert op financieringstype wanneer beide dat noemen', () => {
    const murabaha = template({ financingType: FinancingType.MURABAHA })
    expect(
      templateApplies(murabaha, context({ financingType: FinancingType.MURABAHA })),
    ).toBe(true)
    expect(templateApplies(murabaha, context({ financingType: FinancingType.IJARA }))).toBe(
      false,
    )
  })
})

describe('filteren op fase', () => {
  const notaryTemplate = template({ stage: JourneyStage.NOTARY })

  it('toont alle fasen wanneer de context er geen noemt', () => {
    // Dat is het volledige overzicht op /checklists.
    expect(templateApplies(notaryTemplate, context())).toBe(true)
  })

  it('toont alleen de gevraagde fase wanneer die genoemd is', () => {
    expect(templateApplies(notaryTemplate, context({ stage: JourneyStage.NOTARY }))).toBe(true)
    expect(templateApplies(notaryTemplate, context({ stage: JourneyStage.BUDGET }))).toBe(false)
  })

  it('toont een template zonder fase in elke fase', () => {
    expect(templateApplies(template({ stage: null }), context({ stage: JourneyStage.BUDGET }))).toBe(
      true,
    )
  })
})

describe('geldigheidsvenster', () => {
  const on = new Date('2026-08-07')

  it('geldt niet vóór de ingangsdatum', () => {
    expect(
      templateApplies(template({ validFrom: new Date('2027-01-01') }), context({ on })),
    ).toBe(false)
  })

  it('geldt niet na de einddatum', () => {
    expect(
      templateApplies(template({ validUntil: new Date('2026-01-01') }), context({ on })),
    ).toBe(false)
  })

  it('geldt binnen het venster', () => {
    expect(
      templateApplies(
        template({ validFrom: new Date('2026-01-01'), validUntil: new Date('2027-01-01') }),
        context({ on }),
      ),
    ).toBe(true)
  })
})

describe('selecteren', () => {
  it('laat de hoogste versie winnen bij dezelfde sleutel', () => {
    // Een herziene lijst uitrollen zonder de oude te verwijderen: bestaande
    // voortgang hangt aan de items van de oude.
    const selected = selectTemplates(
      [
        template({ id: 'oud', key: 'be.notary', version: 1 }),
        template({ id: 'nieuw', key: 'be.notary', version: 2 }),
      ],
      context(),
    )

    expect(selected).toHaveLength(1)
    expect(selected[0]?.id).toBe('nieuw')
  })

  it('sorteert op weergavevolgorde', () => {
    const selected = selectTemplates(
      [
        template({ id: 'c', key: 'c', sortOrder: 30 }),
        template({ id: 'a', key: 'a', sortOrder: 10 }),
        template({ id: 'b', key: 'b', sortOrder: 20 }),
      ],
      context(),
    )
    expect(selected.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('geeft niets terug wanneer niets van toepassing is', () => {
    expect(selectTemplates([template({ country: 'NL' })], context())).toEqual([])
  })
})

const item = (
  importance: ChecklistImportance,
  state: { completed?: boolean; notApplicable?: boolean } = {},
) => ({
  importance,
  completed: state.completed ?? false,
  notApplicable: state.notApplicable ?? false,
})

describe('voortgang op een checklist', () => {
  it('telt een afgevinkt item als afgehandeld', () => {
    expect(isItemResolved(item(ChecklistImportance.REQUIRED, { completed: true }))).toBe(true)
  })

  it('telt "niet van toepassing" als afgehandeld', () => {
    // Wie geen mazoutketel heeft, hoort niet eeuwig een openstaand item
    // "keuring stookolietank" te zien.
    expect(isItemResolved(item(ChecklistImportance.REQUIRED, { notApplicable: true }))).toBe(true)
  })

  it('rekent alleen verplichte items als blokkerend', () => {
    const progress = checklistProgress([
      item(ChecklistImportance.REQUIRED, { completed: true }),
      item(ChecklistImportance.REQUIRED),
      item(ChecklistImportance.RECOMMENDED),
      item(ChecklistImportance.OPTIONAL),
    ])

    expect(progress.total).toBe(4)
    expect(progress.required).toBe(2)
    expect(progress.requiredOpen).toBe(1)
    expect(progress.requiredComplete).toBe(false)
  })

  it('is klaar wanneer alle verplichte items af zijn, ook met open aanbevelingen', () => {
    const progress = checklistProgress([
      item(ChecklistImportance.REQUIRED, { completed: true }),
      item(ChecklistImportance.RECOMMENDED),
    ])

    expect(progress.requiredComplete).toBe(true)
    expect(progress.percentage).toBe(50)
  })

  it('geeft 0 % bij een lege lijst zonder te delen door nul', () => {
    expect(checklistProgress([]).percentage).toBe(0)
    expect(checklistProgress([]).requiredComplete).toBe(true)
  })
})

describe('voorbehoud', () => {
  it('presenteert een checklist nooit als juridisch volledig', () => {
    // Een afgevinkte lijst mag niet overkomen als een garantie dat een dossier
    // compleet is.
    expect(CHECKLIST_DISCLAIMER).toContain('kunnen verschillen')
    expect(CHECKLIST_DISCLAIMER.toLowerCase()).not.toContain('volledig en juridisch')
  })
})
