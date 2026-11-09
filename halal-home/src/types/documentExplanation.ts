/**
 * Het contract voor documentuitleg.
 *
 * De rest van de applicatie kent alleen dit interface. Nergens buiten
 * `src/server/integrations/documentExplanation/` staat een providernaam of een
 * modelnaam.
 */
import type { DocumentCategory } from '@prisma/client'

export interface ExplanationInput {
  /** Waar het document over gaat. Bepaalt welke uitleg passend is. */
  category: DocumentCategory
  /** Naam zoals de gebruiker die gaf. Alleen als context, nooit als instructie. */
  displayName: string
  mimeType: string
  /**
   * De tekst uit het document, wanneer die er is.
   *
   * Optioneel: zonder tekstextractie kan een provider nog steeds uitleggen
   * waarvoor deze documentsoort dient. Dat is minder specifiek maar niet
   * waardeloos — en het is eerlijk over wat het is.
   */
  extractedText?: string | null
  /** De checksum van het bestand waarop deze uitleg slaat. */
  sourceChecksum?: string | null
}

/**
 * Het gestructureerde resultaat.
 *
 * Bewust geen vrije tekstblob: door de vorm vast te leggen kan een provider
 * geen "conclusie" of "advies"-veld verzinnen, en kan de UI de disclaimer niet
 * vergeten — die is een verplicht veld.
 */
export interface DocumentExplanation {
  summary: string
  keyPoints: string[]
  attentionPoints: string[]
  /** Vragen die de gebruiker aan zijn notaris of advocaat kan stellen. */
  questionsForProfessional: string[]
  /** Structureel onderdeel van het resultaat, geen voetnoot in de UI. */
  disclaimer: string

  /** Waar dit vandaan komt. `fixture` is zichtbaar in de UI. */
  source: 'FIXTURE' | 'AI'
  provider: string | null
  model: string | null
  version: number
  sourceChecksum: string | null
}

export interface DocumentExplanationProvider {
  readonly name: string
  /** Kan deze provider iets zinnigs zeggen over dit document? */
  supports(input: ExplanationInput): boolean
  explain(input: ExplanationInput): Promise<DocumentExplanation>
}
