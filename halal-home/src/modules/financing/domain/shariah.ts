/**
 * Herkomst van shariah-beweringen.
 *
 * DE REGEL VAN DIT BESTAND: Halal Home velt geen religieus oordeel.
 *
 * Het platform is geen mufti en mag geen fatwa uitspreken — niet in code, niet
 * via AI, niet impliciet via een groen vinkje. Wat het wél doet is nauwkeurig
 * weergeven wie wát beweert, op basis van welk document, en wanneer dat voor
 * het laatst is nagekeken. De gebruiker beslist zelf, eventueel met een geleerde
 * die hij vertrouwt.
 *
 * Daarom:
 *   - staat er nooit "halal" of "haram" als platformoordeel in de UI;
 *   - draagt elke status verplicht een bron mee (zie `validateAssessment`);
 *   - is UNKNOWN de standaard, want geen informatie is geen goedkeuring.
 */
import { ShariahAssessmentStatus } from '@prisma/client'

export interface ShariahAssessment {
  status: ShariahAssessmentStatus
  certificationBody: string | null
  certificationUrl: string | null
  sourceUrl: string | null
  lastVerifiedAt: Date | null
  disclaimer: string | null
}

export interface AssessmentPresentation {
  /** Korte aanduiding voor een badge. Nooit "halal" of "haram". */
  label: string
  /** Hoe het platform het formuleert. Altijd in indirecte rede. */
  statement: string
  /** Welke aandacht de badge verdient. Bepaalt de kleur, niet het oordeel. */
  tone: 'strong' | 'moderate' | 'weak' | 'neutral'
  /** Moet de UI naast de status ook de bron tonen? Altijd, behalve bij UNKNOWN. */
  requiresSource: boolean
}

/**
 * Hoe elke status in de interface verschijnt.
 *
 * Let op de formuleringen: allemaal in de indirecte rede ("volgens", "de
 * aanbieder omschrijft"). Geen enkele zin hier stelt namens Halal Home dat iets
 * toegestaan is.
 */
export const ASSESSMENT_PRESENTATION: Record<ShariahAssessmentStatus, AssessmentPresentation> = {
  CERTIFIED: {
    label: 'Gecertificeerd door een derde partij',
    statement:
      'Volgens de door de aanbieder verstrekte documentatie is dit product beoordeeld door het hieronder vermelde shariah-orgaan.',
    tone: 'strong',
    requiresSource: true,
  },
  PROVIDER_CLAIMED: {
    label: 'Bewering van de aanbieder',
    statement:
      'De aanbieder omschrijft dit product als shariah-conform. Wij vonden geen beoordeling door een onafhankelijke partij.',
    tone: 'moderate',
    requiresSource: true,
  },
  REVIEWED: {
    label: 'Documentatie nagelezen',
    statement:
      'Wij hebben de publieke documentatie van dit product gelezen en samengevat. Dit is een beschrijving van de constructie, geen religieus oordeel.',
    tone: 'moderate',
    requiresSource: true,
  },
  UNVERIFIED: {
    label: 'Niet nagekeken',
    statement:
      'Wij hebben de documentatie van dit product niet nagekeken. Raadpleeg de bron van de aanbieder.',
    tone: 'weak',
    requiresSource: true,
  },
  UNKNOWN: {
    label: 'Geen informatie',
    statement:
      'Wij hebben geen informatie over de shariah-beoordeling van dit product. Vraag de aanbieder om documentatie.',
    tone: 'neutral',
    requiresSource: false,
  },
}

export interface AssessmentProblem {
  field: keyof ShariahAssessment
  message: string
}

/**
 * Mag deze beoordeling getoond worden?
 *
 * Dit is geen cosmetische validatie. Een CERTIFIED-badge zonder certificerend
 * orgaan is precies de misleiding die dit platform moet voorkomen: de gebruiker
 * ziet een sterk signaal en kan de herkomst niet controleren. Zulke rijen mogen
 * niet gepubliceerd worden.
 */
export function validateAssessment(assessment: ShariahAssessment): AssessmentProblem[] {
  const problems: AssessmentProblem[] = []
  const presentation = ASSESSMENT_PRESENTATION[assessment.status]

  if (presentation.requiresSource && !assessment.sourceUrl) {
    problems.push({
      field: 'sourceUrl',
      message: `Status ${assessment.status} vereist een bron-URL. Zonder vindplaats mag deze bewering niet getoond worden.`,
    })
  }

  if (assessment.status === ShariahAssessmentStatus.CERTIFIED) {
    if (!assessment.certificationBody) {
      problems.push({
        field: 'certificationBody',
        message:
          'CERTIFIED vereist de naam van het certificerende orgaan. "Gecertificeerd" zonder certificeerder is betekenisloos.',
      })
    }
    if (!assessment.certificationUrl) {
      problems.push({
        field: 'certificationUrl',
        message: 'CERTIFIED vereist een link naar het certificaat of de verklaring.',
      })
    }
  }

  if (assessment.status !== ShariahAssessmentStatus.UNKNOWN && !assessment.lastVerifiedAt) {
    problems.push({
      field: 'lastVerifiedAt',
      message:
        'Een bewering zonder verificatiedatum kan jaren oud zijn. Datum is verplicht bij elke status behalve UNKNOWN.',
    })
  }

  return problems
}

export function isPublishable(assessment: ShariahAssessment): boolean {
  return validateAssessment(assessment).length === 0
}

/**
 * Hoe verouderd is deze bewering? Financieringsproducten wijzigen; een
 * verificatie van drie jaar geleden is geen verificatie meer.
 *
 * De grens van 365 dagen is een redactionele keuze, geen wettelijke norm.
 */
export const VERIFICATION_STALE_AFTER_DAYS = 365

export function isVerificationStale(
  lastVerifiedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastVerifiedAt) return true
  const days = (now.getTime() - lastVerifiedAt.getTime()) / 86_400_000
  return days > VERIFICATION_STALE_AFTER_DAYS
}

/**
 * De volledige tekst die onder een product hoort. Bewust hier samengesteld en
 * niet in een component, zodat er geen pagina kan bestaan die de status wél
 * toont en het voorbehoud niet.
 */
export function assessmentDisclosure(assessment: ShariahAssessment): string[] {
  const lines: string[] = [ASSESSMENT_PRESENTATION[assessment.status].statement]

  if (assessment.certificationBody) {
    lines.push(`Vermeld orgaan: ${assessment.certificationBody}.`)
  }
  if (assessment.lastVerifiedAt) {
    const date = new Intl.DateTimeFormat('nl-BE', { dateStyle: 'long' }).format(
      assessment.lastVerifiedAt,
    )
    lines.push(
      isVerificationStale(assessment.lastVerifiedAt)
        ? `Laatst nagekeken op ${date}. Dat is meer dan een jaar geleden — controleer bij de aanbieder.`
        : `Laatst nagekeken op ${date}.`,
    )
  }
  if (assessment.disclaimer) lines.push(assessment.disclaimer)

  lines.push(
    'Halal Home geeft geen religieus advies. Beoordeel zelf, eventueel met een geleerde die je vertrouwt.',
  )

  return lines
}
