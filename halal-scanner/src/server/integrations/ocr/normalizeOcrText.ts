/**
 * OCR-tekst klaarmaken voor de ingrediëntenparser.
 *
 * De grens die deze module bewaakt: opschonen mag, corrigeren niet.
 *
 * Wat wél gebeurt is structureel en verliesloos — een kopregel "Ingrediënten:"
 * weghalen, afbreekstreepjes aan regeleindes herstellen, dubbele spaties
 * samenvouwen. Dat verandert niets aan wélke ingrediënten er staan.
 *
 * Wat NIET gebeurt is raden. Als OCR "geiatine" leest, blijft dat "geiatine".
 * De verleiding om dat naar "gelatine" te corrigeren is groot en precies
 * verkeerd: bij een halal-beoordeling is het verschil tussen "we lazen iets
 * onbekends" en "we hebben er gelatine van gemaakt" het verschil tussen een
 * eerlijke twijfel en een verzonnen zekerheid. De gebruiker corrigeert zelf, in
 * de bewerkbare tekst.
 */

/** Kopregels die geen ingrediënt zijn, in de talen op Belgische verpakkingen. */
const HEADING_PATTERN =
  /^\s*(ingredi[eëè]nten|ingredients|ingr[eé]dients|zutaten|samenstelling|composition)\s*[:.\-–]?\s*/i;

/** Regels die na de ingrediëntenlijst komen en er niet bij horen. */
const TRAILING_SECTION_PATTERN =
  /\b(voedingswaarde|nutritional|valeurs? nutritionnelles?|bewaren|conserver|ten minste houdbaar|te gebruiken (?:tot|voor)|net(?:to)?gewicht|poids net)\b/i;

export interface NormalizedOcrText {
  /** Exact wat de provider teruggaf. Blijft altijd bewaard. */
  readonly original: string;
  /** Opgeschoonde versie, klaar voor de ingrediëntenparser. */
  readonly normalized: string;
  /** Wat er is weggehaald; zichtbaar te maken zodat opschonen navolgbaar is. */
  readonly removedHeading: boolean;
  readonly removedTrailingSection: boolean;
}

export function normalizeOcrText(raw: string): NormalizedOcrText {
  const original = raw;

  // 1. Unicode-eigenaardigheden die camera's en providers opleveren.
  let text = raw
    .replace(/\r\n?/g, "\n")
    // Harde en smalle spaties naar een gewone spatie.
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    // Typografische aanhalings- en koppeltekens naar hun ASCII-vorm, zodat de
    // parser niet op twee varianten van hetzelfde teken hoeft te matchen.
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, "-");

  // 2. Woordafbreking aan het regeleinde herstellen: "emul-\ngator" is één woord.
  text = text.replace(/(\p{Letter})-\n(\p{Letter})/gu, "$1$2");

  // 3. Overige regeleindes worden spaties. Een ingrediëntenlijst is één zin die
  //    toevallig over meerdere regels op de verpakking staat.
  text = text.replace(/\n+/g, " ");

  // 4. Kopregel weg.
  const withoutHeading = text.replace(HEADING_PATTERN, "");
  const removedHeading = withoutHeading !== text;
  text = withoutHeading;

  // 5. Alles vanaf een duidelijke volgende sectie afkappen.
  let removedTrailingSection = false;
  const trailingMatch = TRAILING_SECTION_PATTERN.exec(text);
  if (trailingMatch && trailingMatch.index > 0) {
    text = text.slice(0, trailingMatch.index);
    removedTrailingSection = true;
  }

  // 6. Spaties samenvouwen en losse leestekens aan de randen weghalen.
  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim()
    .replace(/^[,.;:\-\s]+/, "")
    .replace(/[,.;:\-\s]+$/, "");

  return { original, normalized: text, removedHeading, removedTrailingSection };
}

/**
 * Zitten er signalen in de tekst die op een ingrediëntenlijst wijzen?
 *
 * De naam zegt bewust "signalen" en niet "is een lijst". Dit is een heuristiek
 * met precies één doel: het verschil zien tussen "de foto bevatte tekst maar
 * geen ingrediëntenlijst" en "de foto bevatte niets", want die twee vragen om
 * een andere melding aan de gebruiker.
 *
 * Wat het NIET is:
 *
 *  - geen validatie — een `true` betekent niet dat de tekst bruikbaar is;
 *  - geen security boundary — er hangt geen enkele veiligheidsbeslissing aan;
 *  - geen kwaliteitsoordeel over de OCR.
 *
 * Valse positieven zijn acceptabel: de gebruiker belandt hoe dan ook in het
 * controlescherm en kan de tekst corrigeren. Valse negatieven leveren alleen
 * een extra waarschuwing op, geen blokkade.
 */
export function hasIngredientListSignals(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  // Een ingrediëntenlijst is een opsomming; zonder enig scheidingsteken is het
  // waarschijnlijk een merknaam of een slogan.
  return /[,;]/.test(trimmed) || /\bE\s?\d{3}\b/i.test(trimmed);
}
