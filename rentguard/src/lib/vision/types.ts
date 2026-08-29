import type { Locale } from '@/i18n/config';
import type { DamageClassification } from '@/lib/supabase/types';

/**
 * Provider-agnostische interface voor beeldvergelijking.
 *
 * De interface is bewust smal: één methode, één resultaattype. Een tweede
 * adapter (bv. OpenAI) hoeft alleen `comparePhotos` te implementeren; de
 * aanroepende code verandert niet.
 *
 * Wat een analyzer **niet** mag doen, staat in `docs/decisions/0004`:
 * geen kostenschatting, geen juridische kwalificatie, geen wetsartikelen.
 */

export interface VisionPhotoInput {
  bytes: Uint8Array;
  contentType: string;
  /** Naam van de kamer, zoals de gebruiker die ziet. */
  roomLabel: string;
  /** Wat er gefotografeerd is (vloer, muren, …). */
  slotLabel: string;
}

export interface VisionCompareInput {
  locale: Locale;
  checkIn: VisionPhotoInput;
  checkOut: VisionPhotoInput;
  /** Bewoningsduur in maanden; helpt bij het inschatten van normale slijtage. */
  monthsOccupied: number | null;
  /**
   * Toegestane sleutels uit de herstelkostentabel. Het model kiest hieruit;
   * het mag geen eigen posten verzinnen.
   */
  allowedRepairItemKeys: string[];
}

export interface VisionComparisonResult {
  /** Definitieve classificatie, na toepassing van de zekerheidsdrempel. */
  classification: DamageClassification;
  /** Wat het model zelf zei, vóór de drempel. */
  rawClassification: DamageClassification;
  confidence: number;
  /** Waarneembare verschillen tussen beide foto's, feitelijk beschreven. */
  observedDifferences: string[];
  /** Waarom het model tot deze classificatie komt. */
  reasoning: string;
  /** Sleutels uit de herstelkostentabel, gefilterd op de toegestane lijst. */
  suggestedRepairItemKeys: string[];
  /** True wanneer de drempel het resultaat naar UNCLEAR heeft geduwd. */
  forcedUnclear: boolean;
  /** True wanneer het model de vraag heeft geweigerd. */
  refused: boolean;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface VisionAnalyzer {
  readonly id: string;
  readonly model: string;
  comparePhotos(input: VisionCompareInput): Promise<VisionComparisonResult>;
}

export class VisionUnavailableError extends Error {
  constructor() {
    super(
      'Er is geen vision-provider geconfigureerd. Zet ANTHROPIC_API_KEY of ' +
        'laat de gebruiker handmatig classificeren.',
    );
    this.name = 'VisionUnavailableError';
  }
}

/**
 * Past de zekerheidsdrempel toe.
 *
 * Onder de drempel wordt het resultaat naar UNCLEAR geduwd, ongeacht wat het
 * model zei. Een onzekere machine die "schade" zegt, kost de gebruiker geld.
 */
export function applyConfidenceThreshold(
  classification: DamageClassification,
  confidence: number,
  threshold: number,
): { classification: DamageClassification; forcedUnclear: boolean } {
  if (classification === 'UNCLEAR') {
    return { classification, forcedUnclear: false };
  }
  if (confidence < threshold) {
    return { classification: 'UNCLEAR', forcedUnclear: true };
  }
  return { classification, forcedUnclear: false };
}
