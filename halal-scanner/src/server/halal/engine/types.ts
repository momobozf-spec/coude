/**
 * De drie stappen van de analyse, elk met een eigen type.
 *
 *   Evidence verzamelen  ≠  Evidence interpreteren  ≠  Finale status bepalen
 *
 * Die scheiding is hier geen stijlkeuze maar de kern van het ontwerp:
 *
 *  1. `Evidence` bevat uitsluitend FEITEN. Welke ingrediënten stonden er, welke
 *     referentierecords matchten, welke certificaten hangen aan dit product.
 *     Geen enkel oordeel. Deze stap raakt de database.
 *  2. `Interpretation` bevat het oordeel PER INGREDIËNT. Van feit naar bevinding:
 *     "E471 is mushbooh want de herkomst kan dierlijk zijn". Puur en synchroon.
 *  3. `Decision` bevat het EINDOORDEEL over het product, inclusief de botsing
 *     tussen certificaat en ingrediënten. Puur, synchroon en deterministisch:
 *     dezelfde interpretatie levert altijd exact dezelfde beslissing op.
 *
 * Waarom dit uit elkaar moet: zonder die grens sluipt er een oordeel in de
 * verzamelstap ("dit ingrediënt sla ik over want het is toch onschuldig") en
 * wordt de uitkomst onverklaarbaar. Nu is elke stap los te testen en is van elke
 * status terug te leiden op welk feit hij rust.
 */
import type {
  ConfidenceLevel,
  FindingType,
  HalalStatus,
  OriginRisk,
} from "@prisma/client";
import type {
  CertificateEvidence,
  IngredientFinding,
  SourceReference,
} from "@/types/halal";

/* ───────────────────────────── stap 1: feiten ───────────────────────────── */

/** Een referentierecord voor een ingrediënt, zoals het in de database staat. */
export interface IngredientReference {
  id: string;
  name: string;
  normalizedName: string;
  defaultStatus: HalalStatus;
  defaultConfidence: ConfidenceLevel;
  originRisk: OriginRisk;
  eNumberCode: string | null;
  /** Alle schrijfwijzen waaronder dit ingrediënt herkend mag worden. */
  aliases: string[];
  source: SourceReference | null;
}

export interface ENumberReference {
  id: string;
  code: string;
  name: string;
  defaultStatus: HalalStatus;
  defaultConfidence: ConfidenceLevel;
  originRisk: OriginRisk;
  animalDerivedPossible: boolean;
  plantDerivedPossible: boolean;
  syntheticPossible: boolean;
  source: SourceReference | null;
}

/**
 * Wat de matcher voor één etiketterm gevonden heeft.
 *
 * `matchedText` is de referentieterm die aansloeg, niet de etiketterm. Daarmee
 * kan de interpretatiestap de regel "de langste match wint" toepassen zonder
 * zelf te hoeven zoeken: "varkensgelatine" (15) verslaat "gelatine" (8).
 */
export interface IngredientMatch {
  /** De genormaliseerde term zoals die op het etiket stond. */
  token: string;
  /** De ruwe term zoals de gebruiker hem ziet. */
  rawToken: string;
  matchedText: string;
  matchKind: "exact" | "alias" | "contains";
  reference: IngredientReference;
}

export interface ENumberMatch {
  token: string;
  rawToken: string;
  reference: ENumberReference;
}

/**
 * Alle feiten die de beslissing kunnen dragen. Bewust géén statussen op
 * productniveau: die worden pas in stap 3 bepaald.
 */
export interface Evidence {
  /** Stond er überhaupt een ingrediëntenlijst? Bepaalt UNKNOWN vs MUSHBOOH. */
  hasIngredientsText: boolean;
  /** Alle etiketttermen, in de volgorde van het etiket. */
  tokens: EvidenceToken[];
  certificates: CertificateEvidence[];
  productRevisionId: string | null;
}

/** Eén etiketterm met de referentierecords die erop aansloegen. */
export interface EvidenceToken {
  raw: string;
  normalized: string;
  /** Uit de parser: het herkende E-nummer, indien aanwezig. */
  eNumberCode: string | null;
  ingredientMatches: IngredientMatch[];
  eNumberMatches: ENumberMatch[];
}

/* ──────────────────────── stap 2: interpretatie ─────────────────────────── */

/**
 * De bevindingen per ingrediënt. Nog géén productstatus: die volgt in stap 3.
 * `findings` is exact wat de UI onder "Waarom deze beoordeling?" toont.
 */
export interface Interpretation {
  findings: IngredientFinding[];
  /** Aantal etiketttermen dat op geen enkel referentierecord aansloeg. */
  unknownCount: number;
  /** Aantal beoordeelde etiketttermen. */
  totalCount: number;
}

/* ───────────────────────── stap 3: beslissing ───────────────────────────── */

export interface Decision {
  status: HalalStatus;
  confidence: ConfidenceLevel;
  /** Certificaat en ingrediënten spreken elkaar tegen. */
  hasConflict: boolean;
  /**
   * Afgeleid van `hasConflict`. Staat als eigen veld in het contract omdat de
   * UI en de moderatiewachtrij hierop sturen, en omdat de reden om menselijke
   * verificatie te vragen in de toekomst kan groeien zonder dat elke
   * aanroeper mee hoeft te veranderen.
   */
  needsHumanReview: boolean;
  /** Bevindingen inclusief een eventuele CONFLICT-bevinding. */
  findings: IngredientFinding[];
  summary: string;
}

export type { ConfidenceLevel, FindingType, HalalStatus, OriginRisk };
