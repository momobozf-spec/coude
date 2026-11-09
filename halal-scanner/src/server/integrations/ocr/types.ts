/**
 * Het contract voor tekstherkenning.
 *
 * De rest van de applicatie kent uitsluitend deze vorm. Geen enkele
 * provider-specifieke structuur — geen `TextAnnotation`, geen `ReadResult`, geen
 * `choices[0].message.content` — komt buiten de adapter. Daardoor is een
 * provider vervangen een kwestie van één bestand toevoegen, en kan de hele
 * OCR-flow getest worden zonder ook maar één externe aanroep.
 *
 * Let op de rolverdeling: een OCR-provider levert TEKST. Hij levert geen
 * ingrediëntenlijst, geen beoordeling en al helemaal geen halal-status. Wat de
 * tekst betekent, bepaalt de bestaande analyse-engine — precies zoals bij een
 * gescande barcode. Er wordt dus nooit aan een vision-model gevraagd of iets
 * halal is; er wordt gevraagd wat er op het etiket staat.
 */

export interface OcrInput {
  /** De ruwe afbeelding. */
  readonly image: ArrayBuffer;
  readonly mimeType: string;
  /**
   * Taalhint. Belgische verpakkingen zijn meertalig, dus dit is een hint en
   * geen filter: een provider mag er meer talen uit halen.
   */
  readonly languageHint?: string;
  /**
   * Afbreeksignaal van de timeoutlaag. Een provider die HTTP doet hoort dit
   * door te geven aan zijn `fetch`, zodat een afgebroken aanroep ook echt stopt
   * in plaats van op de achtergrond door te lopen en alsnog te kosten.
   */
  readonly signal?: AbortSignal;
}

export interface OcrResult {
  /** De herkende tekst, zoals de provider hem teruggaf. */
  readonly text: string;
  /**
   * Ruwe zekerheidsscore van de provider, wanneer die er een geeft.
   *
   * LET OP: dit getal is niet vergelijkbaar tussen providers. De één geeft een
   * gemiddelde per woord, de ander een waarde per regel, een derde geeft niets.
   * Daarom mag niemand buiten de adapterlaag hier een drempel op leggen — die
   * vertaling gebeurt via `confidencePolicy` hieronder.
   *
   * En belangrijker: zekerheid gaat over TEKSTHERKENNING. Niet over of de
   * ingrediënten kloppen, en al helemaal niet over de halal-conclusie. Ook bij
   * 0.99 blijft de menselijke controlestap verplicht.
   */
  readonly confidence?: number;
  /** Waarschuwingen die de gebruiker moet zien, in gewone taal. */
  readonly warnings?: readonly string[];
  /** Welke provider dit produceerde; gaat mee in de logs, niet naar de client. */
  readonly providerName: string;
  /** Model- of API-versie, als de provider die noemt. Alleen voor diagnose. */
  readonly providerModel?: string;
}

/**
 * Hoe de ruwe score van deze provider vertaald wordt naar het domeinbegrip
 * "lage zekerheid".
 *
 * Dit hoort bij de provider en niet bij de applicatie, omdat 0.8 bij de ene
 * dienst iets heel anders betekent dan bij de andere. Een nieuwe provider moet
 * hier een waarde kiezen én in de adapter onderbouwen waar die vandaan komt.
 * Geen onderbouwing beschikbaar? Dan `{ kind: "none" }` — dan waarschuwt de UI
 * niet op basis van zekerheid, wat eerlijker is dan een verzonnen drempel.
 */
export type OcrConfidencePolicy =
  | { readonly kind: "none" }
  | { readonly kind: "threshold"; readonly lowBelow: number };

export interface OcrProvider {
  readonly name: string;
  /** Zie `OcrConfidencePolicy`. Ontbreekt hij, dan telt zekerheid niet mee. */
  readonly confidencePolicy?: OcrConfidencePolicy;
  /**
   * Haalt tekst uit een afbeelding.
   *
   * @throws {AppError} met een `PROVIDER_*`-code bij een providerfout. De
   *         adapter vertaalt providerspecifieke fouten; hogerop wordt nooit op
   *         een providerfoutcode gematcht.
   */
  extractText(input: OcrInput): Promise<OcrResult>;
}

/**
 * Herkomst van een resultaat, voor logs en diagnose. Gaat NIET naar de client:
 * welke leverancier de tekst las, verandert niets aan wat de gebruiker moet
 * doen, en providerinterna horen de UI niet te sturen.
 */
export interface OcrProvenance {
  readonly provider: string;
  readonly providerModel: string | null;
  readonly processedAt: string;
}

/**
 * Standaarddrempel voor providers die geen eigen beleid meegeven.
 *
 * Bewust conservatief. Hij bestaat alleen omdat de fixture-provider een
 * realistisch getal moet kunnen teruggeven; een echte provider hoort een eigen,
 * onderbouwde waarde te declareren.
 */
export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.7;

/** @deprecated Gebruik de `confidencePolicy` van de provider. */
export const LOW_CONFIDENCE_THRESHOLD = DEFAULT_LOW_CONFIDENCE_THRESHOLD;

/**
 * Minder tekens dan dit is vrijwel zeker geen ingrediëntenlijst. Beter een
 * eerlijke "te weinig tekst gevonden" dan een analyse op drie letters.
 */
export const MIN_USABLE_TEXT_LENGTH = 15;

/**
 * Vertaalt een ruwe providerscore naar het domeinbegrip.
 *
 * Eén plek, zodat de UI nooit zelf een getal met een drempel vergelijkt.
 */
export function isLowConfidence(
  confidence: number | null,
  policy: OcrConfidencePolicy | undefined,
): boolean {
  if (confidence === null) return false;
  const effective = policy ?? { kind: "threshold" as const, lowBelow: DEFAULT_LOW_CONFIDENCE_THRESHOLD };
  if (effective.kind === "none") return false;
  return confidence < effective.lowBelow;
}
