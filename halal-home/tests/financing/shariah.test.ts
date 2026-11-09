import { describe, expect, it } from 'vitest'
import { ShariahAssessmentStatus } from '@prisma/client'

import {
  ASSESSMENT_PRESENTATION,
  assessmentDisclosure,
  isPublishable,
  isVerificationStale,
  validateAssessment,
  type ShariahAssessment,
} from '@/modules/financing/domain/shariah'

const assessment = (overrides: Partial<ShariahAssessment> = {}): ShariahAssessment => ({
  status: ShariahAssessmentStatus.UNKNOWN,
  certificationBody: null,
  certificationUrl: null,
  sourceUrl: null,
  lastVerifiedAt: null,
  disclaimer: null,
  ...overrides,
})

describe('presentatie van een beoordeling', () => {
  it('heeft voor elke status een formulering', () => {
    for (const status of Object.values(ShariahAssessmentStatus)) {
      expect(ASSESSMENT_PRESENTATION[status]).toBeDefined()
      expect(ASSESSMENT_PRESENTATION[status].statement.length).toBeGreaterThan(0)
    }
  })

  it('beweert nergens zelf dat iets halal of haram is', () => {
    // Dit is de kernbelofte van het platform. Als deze test faalt, is er een
    // formulering ingeslopen die het platform een religieus oordeel laat vellen.
    for (const status of Object.values(ShariahAssessmentStatus)) {
      const presentation = ASSESSMENT_PRESENTATION[status]
      const text = `${presentation.label} ${presentation.statement}`.toLowerCase()

      expect(text).not.toMatch(/\bis halal\b/)
      expect(text).not.toMatch(/\bis haram\b/)
      expect(text).not.toMatch(/\btoegestaan volgens ons\b/)
    }
  })

  it('eist een bron bij elke status behalve UNKNOWN', () => {
    for (const status of Object.values(ShariahAssessmentStatus)) {
      const expected = status !== ShariahAssessmentStatus.UNKNOWN
      expect(ASSESSMENT_PRESENTATION[status].requiresSource).toBe(expected)
    }
  })
})

describe('validatie van een beoordeling', () => {
  it('keurt UNKNOWN zonder bron goed', () => {
    // Geen informatie is een geldige toestand — en het veilige antwoord.
    expect(isPublishable(assessment())).toBe(true)
  })

  it('weigert CERTIFIED zonder certificerend orgaan', () => {
    // "Gecertificeerd" zonder certificeerder is betekenisloos en misleidend:
    // de gebruiker ziet een sterk signaal dat hij niet kan controleren.
    const problems = validateAssessment(
      assessment({
        status: ShariahAssessmentStatus.CERTIFIED,
        sourceUrl: 'https://example.com/product',
        certificationUrl: 'https://example.com/certificaat',
        lastVerifiedAt: new Date(),
      }),
    )
    expect(problems.map((p) => p.field)).toContain('certificationBody')
  })

  it('weigert CERTIFIED zonder link naar het certificaat', () => {
    const problems = validateAssessment(
      assessment({
        status: ShariahAssessmentStatus.CERTIFIED,
        sourceUrl: 'https://example.com/product',
        certificationBody: 'Voorbeeld Shariah Board',
        lastVerifiedAt: new Date(),
      }),
    )
    expect(problems.map((p) => p.field)).toContain('certificationUrl')
  })

  it('weigert PROVIDER_CLAIMED zonder bron', () => {
    const problems = validateAssessment(
      assessment({
        status: ShariahAssessmentStatus.PROVIDER_CLAIMED,
        lastVerifiedAt: new Date(),
      }),
    )
    expect(problems.map((p) => p.field)).toContain('sourceUrl')
  })

  it('weigert elke onderbouwde status zonder verificatiedatum', () => {
    // Een bewering zonder datum kan jaren oud zijn.
    const problems = validateAssessment(
      assessment({
        status: ShariahAssessmentStatus.REVIEWED,
        sourceUrl: 'https://example.com/product',
      }),
    )
    expect(problems.map((p) => p.field)).toContain('lastVerifiedAt')
  })

  it('keurt een volledig ingevulde CERTIFIED goed', () => {
    expect(
      isPublishable(
        assessment({
          status: ShariahAssessmentStatus.CERTIFIED,
          certificationBody: 'Voorbeeld Shariah Board',
          certificationUrl: 'https://example.com/certificaat',
          sourceUrl: 'https://example.com/product',
          lastVerifiedAt: new Date(),
        }),
      ),
    ).toBe(true)
  })
})

describe('verouderde verificatie', () => {
  const now = new Date('2026-08-07T00:00:00.000Z')

  it('beschouwt een ontbrekende datum als verouderd', () => {
    expect(isVerificationStale(null, now)).toBe(true)
  })

  it('beschouwt een recente verificatie als actueel', () => {
    expect(isVerificationStale(new Date('2026-06-01T00:00:00.000Z'), now)).toBe(false)
  })

  it('beschouwt een verificatie ouder dan een jaar als verouderd', () => {
    expect(isVerificationStale(new Date('2024-01-01T00:00:00.000Z'), now)).toBe(true)
  })
})

describe('de tekst onder een product', () => {
  it('sluit altijd af met het voorbehoud dat we geen religieus advies geven', () => {
    // Dit staat in de domeinlaag en niet in een component, zodat er geen pagina
    // kan bestaan die de status wél toont en het voorbehoud niet.
    for (const status of Object.values(ShariahAssessmentStatus)) {
      const lines = assessmentDisclosure(assessment({ status }))
      expect(lines.at(-1)).toContain('geen religieus advies')
    }
  })

  it('waarschuwt wanneer de verificatie meer dan een jaar oud is', () => {
    const lines = assessmentDisclosure(
      assessment({
        status: ShariahAssessmentStatus.REVIEWED,
        sourceUrl: 'https://example.com',
        lastVerifiedAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    )
    expect(lines.join(' ')).toContain('meer dan een jaar geleden')
  })

  it('noemt het certificerende orgaan wanneer het bekend is', () => {
    const lines = assessmentDisclosure(
      assessment({
        status: ShariahAssessmentStatus.CERTIFIED,
        certificationBody: 'Voorbeeld Shariah Board',
        certificationUrl: 'https://example.com/cert',
        sourceUrl: 'https://example.com',
        lastVerifiedAt: new Date(),
      }),
    )
    expect(lines.join(' ')).toContain('Voorbeeld Shariah Board')
  })
})
