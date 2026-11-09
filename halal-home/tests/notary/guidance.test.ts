import { describe, expect, it } from 'vitest'

import {
  BE_NOTARY_PHASES,
  GUIDANCE_KIND_LABELS,
  NOTARY_DISCLAIMER,
  QUESTIONS_FOR_NOTARY,
} from '@/modules/notary/domain/guidance'
import { findLegalAdvice } from '@/modules/documents/domain/legalGuardrails'
import { BE_CHECKLISTS } from '../../prisma/seed-data/checklists'

describe('het traject', () => {
  it('heeft drie stappen: voor, tijdens en na', () => {
    expect(BE_NOTARY_PHASES.map((p) => p.key)).toEqual(['before', 'deed', 'after'])
  })

  it('geeft elke stap een samenvatting en blokken', () => {
    for (const phase of BE_NOTARY_PHASES) {
      expect(phase.summary.length, phase.key).toBeGreaterThan(20)
      expect(phase.blocks.length, phase.key).toBeGreaterThan(0)
    }
  })

  it('gebruikt unieke sleutels', () => {
    const keys = BE_NOTARY_PHASES.flatMap((p) => p.blocks.map((b) => b.key))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('de soorten informatie', () => {
  it('kent geen categorie voor oordeel of goedkeuring', () => {
    // De structuur sluit uit dat er ooit een "oordeel"-blok bijkomt.
    const kinds = Object.keys(GUIDANCE_KIND_LABELS)

    expect(kinds).toEqual(['information', 'preparation', 'attention', 'question'])
    expect(kinds).not.toContain('judgement')
    expect(kinds).not.toContain('approval')
    expect(kinds).not.toContain('advice')
  })

  it('gebruikt alleen die vier soorten', () => {
    for (const phase of BE_NOTARY_PHASES) {
      for (const block of phase.blocks) {
        expect(Object.keys(GUIDANCE_KIND_LABELS), block.key).toContain(block.kind)
      }
    }
  })
})

describe('geen juridisch advies', () => {
  it('doorstaat de guardrails in elke tekst', () => {
    // Dezelfde filter als voor AI-uitleg: de strengste controle mag niet
    // alleen gelden voor de tekst die we het minst vertrouwen.
    for (const phase of BE_NOTARY_PHASES) {
      const violations = findLegalAdvice({
        summary: phase.summary,
        keyPoints: phase.blocks.map((b) => b.title),
        attentionPoints: phase.blocks.map((b) => b.body),
        questionsForProfessional: [],
      })
      expect(violations, phase.key).toHaveLength(0)
    }
  })

  it('formuleert termijnen voorzichtig', () => {
    // Termijnen wijzigen; "doorgaans" is eerlijk, een harde norm niet.
    const bodies = BE_NOTARY_PHASES.flatMap((p) => p.blocks.map((b) => b.body)).join(' ')
    expect(/doorgaans|meestal|in de praktijk|vraag na/i.test(bodies)).toBe(true)
  })

  it('noemt geen concrete tarieven', () => {
    // Registratierechten horen in CostRule met een geldigheidsvenster, niet in
    // een vaste tekst.
    const text = BE_NOTARY_PHASES.flatMap((p) => p.blocks.map((b) => b.body)).join(' ')

    expect(text).not.toMatch(/\b\d{1,2}\s*%/)
    expect(text).not.toMatch(/€\s*\d/)
  })

  it('zegt in de disclaimer dat wij niet goedkeuren', () => {
    expect(NOTARY_DISCLAIMER.toLowerCase()).toContain('geen notariële')
    expect(NOTARY_DISCLAIMER.toLowerCase()).toContain('aansprakelijk')
  })
})

describe('vragen voor de notaris', () => {
  it('geeft bij elke vraag een reden waarom ze ertoe doet', () => {
    for (const item of QUESTIONS_FOR_NOTARY) {
      expect(item.question.endsWith('?'), item.key).toBe(true)
      expect(item.why.length, item.key).toBeGreaterThan(20)
    }
  })

  it('dekt de onderwerpen die het meest misgaan', () => {
    const keys = QUESTIONS_FOR_NOTARY.map((q) => q.key)

    expect(keys).toContain('documents_missing')
    expect(keys).toContain('suspensive')
    expect(keys).toContain('full_settlement')
    expect(keys).toContain('urban_planning')
  })

  it('gebruikt unieke sleutels', () => {
    const keys = QUESTIONS_FOR_NOTARY.map((q) => q.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('de koppeling met de checklist-engine', () => {
  it('gebruikt de bestaande be.notary.deed-template', () => {
    // De notarischecklist komt uit de engine, niet uit een hardcoded lijst in
    // een React-component.
    const template = BE_CHECKLISTS.find((c) => c.key === 'be.notary.deed')

    expect(template).toBeDefined()
    expect(template?.scope).toBe('NOTARY')
    expect(template?.items.length).toBeGreaterThan(10)
  })

  it('heeft daar secties die met het traject overeenkomen', () => {
    const template = BE_CHECKLISTS.find((c) => c.key === 'be.notary.deed')!
    const sections = new Set(template.items.map((i) => i.section))

    expect(sections).toContain('Voor de afspraak')
    expect(sections).toContain('Te controleren')
    expect(sections).toContain('Na de akte')
  })

  it('vraagt bij documentitems om een categorie', () => {
    // Zonder `documentCategory` kan de bridge nooit automatisch koppelen.
    const template = BE_CHECKLISTS.find((c) => c.key === 'be.notary.deed')!
    const withDocuments = template.items.filter((i) => i.documentCategory)

    expect(withDocuments.length).toBeGreaterThan(3)
  })
})
