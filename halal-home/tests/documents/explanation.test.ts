/**
 * De uitleg-adapter.
 *
 * Alles hier draait op de fixture-provider: geen credentials, geen netwerk.
 * Dat de AI-provider door dezelfde poort gaat, is precies waarvoor de adapter
 * bestaat.
 */
import { describe, expect, it, vi } from 'vitest'
import { DocumentCategory } from '@prisma/client'

vi.mock('@/server/db/prisma', () => ({ prisma: {} }))

const { FixtureExplanationProvider, FIXTURE_TEMPLATES, GENERIC_TEMPLATE } = await import(
  '@/server/integrations/documentExplanation/fixtureProvider'
)
const { describeDataSentToProvider } = await import(
  '@/server/integrations/documentExplanation'
)
const { findLegalAdvice, EXPLANATION_DISCLAIMER, EXPLANATION_VERSION } = await import(
  '@/modules/documents/domain/legalGuardrails'
)

const provider = new FixtureExplanationProvider()

const input = (category: DocumentCategory) => ({
  category,
  displayName: 'Testdocument',
  mimeType: 'application/pdf',
  sourceChecksum: 'abc123',
})

describe('de fixture-provider', () => {
  it('geeft voor elke categorie uitleg', async () => {
    for (const category of Object.values(DocumentCategory)) {
      const result = await provider.explain(input(category))
      expect(result.summary.length, category).toBeGreaterThan(0)
    }
  })

  it('markeert zichzelf als fixture', async () => {
    const result = await provider.explain(input(DocumentCategory.PURCHASE_AGREEMENT))

    // De UI toont dit; doen alsof een fixture het document gelezen heeft, zou
    // de gebruiker misleiden.
    expect(result.source).toBe('FIXTURE')
    expect(result.model).toBeNull()
  })

  it('draagt de checksum van het bronbestand mee', async () => {
    const result = await provider.explain(input(DocumentCategory.NOTARY))
    expect(result.sourceChecksum).toBe('abc123')
  })

  it('draagt altijd de disclaimer', async () => {
    for (const category of Object.values(DocumentCategory)) {
      const result = await provider.explain(input(category))
      expect(result.disclaimer, category).toBe(EXPLANATION_DISCLAIMER)
    }
  })

  it('geeft een versienummer mee', async () => {
    const result = await provider.explain(input(DocumentCategory.INCOME))
    expect(result.version).toBe(EXPLANATION_VERSION)
  })

  it('valt terug op generieke uitleg bij een onbekende categorie', async () => {
    const result = await provider.explain(input(DocumentCategory.OTHER))
    // Eerlijk over wat het niet weet.
    expect(result.summary).toContain('nog geen specifieke uitleg')
  })

  it('is deterministisch', async () => {
    const a = await provider.explain(input(DocumentCategory.FINANCING))
    const b = await provider.explain(input(DocumentCategory.FINANCING))
    expect(a).toEqual(b)
  })
})

describe('geen enkele fixture-tekst geeft juridisch advies', () => {
  it('doorstaat de guardrails voor elke categorie', async () => {
    // Deze redactionele teksten zijn door een mens geschreven, maar ze gaan door
    // dezelfde filter als modeloutput. Anders zou de strengste controle alleen
    // gelden voor de tekst die we het minst vertrouwen.
    for (const category of Object.values(DocumentCategory)) {
      const result = await provider.explain(input(category))
      expect(findLegalAdvice(result), category).toHaveLength(0)
    }
  })

  it('bevat in elke template vragen voor een professional', () => {
    const templates = [...Object.values(FIXTURE_TEMPLATES), GENERIC_TEMPLATE]

    for (const template of templates) {
      expect(template!.questionsForProfessional.length).toBeGreaterThan(0)
    }
  })

  it('formuleert voorzichtig, met "doorgaans" of "meestal" of "lijkt"', () => {
    // Steekproef op de categorieën waar het juridisch spannend is.
    for (const category of [
      DocumentCategory.PURCHASE_AGREEMENT,
      DocumentCategory.NOTARY,
      DocumentCategory.FINANCING,
    ]) {
      const template = FIXTURE_TEMPLATES[category]!
      const text = [template.summary, ...template.keyPoints].join(' ').toLowerCase()

      expect(
        /(doorgaans|meestal|lijkt|in de praktijk|vaak)/.test(text),
        category,
      ).toBe(true)
    }
  })

  it('verwijst bij notaris en compromis naar de professional', () => {
    for (const category of [DocumentCategory.PURCHASE_AGREEMENT, DocumentCategory.NOTARY]) {
      const template = FIXTURE_TEMPLATES[category]!
      expect(template.questionsForProfessional.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('wat een externe provider zou ontvangen', () => {
  it('noemt alleen metadata wanneer er geen tekstextractie is', () => {
    const lines = describeDataSentToProvider(false).join(' ')

    expect(lines).toContain('categorie')
    expect(lines).toContain('geen tekstextractie')
    expect(lines).toContain('nooit')
  })

  it('meldt het expliciet wanneer er wél tekst meegaat', () => {
    const lines = describeDataSentToProvider(true).join(' ')
    expect(lines).toContain('De tekst uit het document')
  })

  it('zegt in beide gevallen dat het bestand zelf niet meegaat', () => {
    for (const hasText of [true, false]) {
      expect(describeDataSentToProvider(hasText).join(' ')).toContain(
        'Het bestand zelf',
      )
    }
  })
})
