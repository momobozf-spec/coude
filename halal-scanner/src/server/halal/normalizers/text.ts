/**
 * Tekstnormalisatie voor ingredienten en E-nummers.
 *
 * Deze module is bewust vrij van Next.js- en Prisma-afhankelijkheden zodat hij
 * zowel in de rules engine, in de seed als in tests gebruikt kan worden.
 *
 * De karakterklassen zijn met expliciete escapes opgebouwd: onzichtbare tekens
 * letterlijk in de broncode zetten maakt deze module onbewerkbaar.
 */

/** Soft hyphen, zero-width spaces/joiners en BOM - vervuilen etiketteksten. */
const INVISIBLE_CHARS = new RegExp("[\\u00ad\\u200b-\\u200d\\ufeff]", "g");

/** Combining diacritical marks (na NFD-decompositie). */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Zet een vrije tekst om naar een stabiele matchingsleutel.
 *
 *   "  Mono-  en Diglyceriden (E471) " -> "mono en diglyceriden e471"
 *
 * Diacritics worden verwijderd, leestekens worden spaties, en herhaalde
 * spaties worden samengevouwen. Haakjes-inhoud blijft bewaard: die bevat vaak
 * juist het E-nummer of de herkomst ("gelatine (rund)").
 */
export function normalizeText(input: string): string {
  return input
    .replace(INVISIBLE_CHARS, "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normaliseert een ingredientnaam en strip etiket-ruis die niets zegt over de
 * herkomst: percentages en overtollige whitespace.
 */
export function normalizeIngredientName(input: string): string {
  return normalizeText(input)
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Herkent E-nummers in alle gangbare schrijfwijzen.
 *
 *   "E471", "E-471", "e 471" -> "E471"
 *   "E 472e"                 -> "E472E"
 *
 * De letter-suffix (E472a..f) blijft behouden: die duidt een ander additief aan.
 */
const E_NUMBER_SOURCE = "\\bE[\\s\\-.]?(\\d{3,4})\\s*([a-z](?:\\s*[ivx]+)?)?\\b";

function toCanonicalCode(digits: string, suffix: string | undefined): string {
  return `E${digits}${(suffix ?? "").replace(/\s+/g, "").toUpperCase()}`;
}

/** Canonieke code als de input een E-nummer bevat, anders null. */
export function normalizeENumberCode(input: string): string | null {
  const match = new RegExp(E_NUMBER_SOURCE, "i").exec(input.trim());
  if (!match?.[1]) return null;
  return toCanonicalCode(match[1], match[2]);
}

/** Alle E-nummers uit een vrije tekst, ontdubbeld, in volgorde van voorkomen. */
export function extractENumbers(input: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(E_NUMBER_SOURCE, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (!match[1]) continue;
    const code = toCanonicalCode(match[1], match[2]);
    if (!seen.has(code)) {
      seen.add(code);
      found.push(code);
    }
  }
  return found;
}
