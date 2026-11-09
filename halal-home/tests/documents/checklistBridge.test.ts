/**
 * Wanneer een geüpload document een checklist-item mag afvinken.
 *
 * De regel: een bestand bewijst aanwezigheid, niet juistheid. Een geüploade
 * compromisakte bewijst dat er een compromisakte in het dossier zit — niet dat
 * de opschortende voorwaarde deugt.
 */
import { describe, expect, it, vi } from 'vitest'
import { DocumentCategory, DocumentStatus } from '@prisma/client'

vi.mock('@/server/db/prisma', () => ({ prisma: {} }))

const { mayAutoComplete, NEVER_AUTO_COMPLETED } = await import(
  '@/modules/documents/checklistBridge'
)

const available = { status: DocumentStatus.AVAILABLE, category: DocumentCategory.IDENTITY }

describe('items die om een document vragen', () => {
  it('vinkt af bij een passend, beschikbaar document', () => {
    const decision = mayAutoComplete(
      { key: 'doc.identity_card', documentCategory: DocumentCategory.IDENTITY },
      available,
    )
    expect(decision.allowed).toBe(true)
  })

  it('vinkt niet af bij een andere categorie', () => {
    const decision = mayAutoComplete(
      { key: 'doc.payslips', documentCategory: DocumentCategory.INCOME },
      available,
    )

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('INCOME')
  })

  it('vinkt niet af zolang het document niet beschikbaar is', () => {
    for (const status of [DocumentStatus.PENDING, DocumentStatus.FAILED, DocumentStatus.EXPIRED]) {
      const decision = mayAutoComplete(
        { key: 'doc.identity_card', documentCategory: DocumentCategory.IDENTITY },
        { status, category: DocumentCategory.IDENTITY },
      )
      expect(decision.allowed, status).toBe(false)
    }
  })
})

describe('items die om een handeling of beoordeling vragen', () => {
  it('vinkt nooit af, ook niet met een passend document', () => {
    // Dit is de kern: "controleer het bodemattest" is niet gedaan omdat er een
    // bodemattest in de kluis zit.
    for (const key of NEVER_AUTO_COMPLETED) {
      const decision = mayAutoComplete(
        { key, documentCategory: DocumentCategory.PROPERTY },
        { status: DocumentStatus.AVAILABLE, category: DocumentCategory.PROPERTY },
      )

      expect(decision.allowed, key).toBe(false)
      expect(decision.reason).toContain('zelf af')
    }
  })

  it('bevat de items die om nakijken vragen', () => {
    expect(NEVER_AUTO_COMPLETED).toContain('notary.soil_certificate')
    expect(NEVER_AUTO_COMPLETED).toContain('notary.urban_info')
    expect(NEVER_AUTO_COMPLETED).toContain('notary.electrical_inspection')
  })

  it('bevat de items die om een handeling vragen', () => {
    expect(NEVER_AUTO_COMPLETED).toContain('notary.utilities_transfer')
    expect(NEVER_AUTO_COMPLETED).toContain('notary.address_change')
  })
})

describe('items zonder documentvraag', () => {
  it('worden niet afgevinkt door een upload', () => {
    const decision = mayAutoComplete({ key: 'notary.title_deed', documentCategory: null }, available)
    expect(decision.allowed).toBe(false)
  })

  it('geven een begrijpelijke reden', () => {
    const decision = mayAutoComplete({ key: 'iets.anders', documentCategory: null }, available)
    expect(decision.reason).toContain('vraagt niet om een document')
  })
})

describe('de reden is altijd bruikbaar', () => {
  it('legt bij elke weigering uit waarom', () => {
    const cases = [
      { item: { key: 'notary.soil_certificate', documentCategory: DocumentCategory.PROPERTY } },
      { item: { key: 'x', documentCategory: null } },
      { item: { key: 'doc.payslips', documentCategory: DocumentCategory.INCOME } },
    ]

    for (const { item } of cases) {
      const decision = mayAutoComplete(item, available)
      expect(decision.allowed).toBe(false)
      expect(decision.reason.length, item.key).toBeGreaterThan(10)
    }
  })
})
