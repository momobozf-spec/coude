/**
 * Losse ingrediëntentekst analyseren, zonder product.
 *
 * Dit is nadrukkelijk GEEN tweede analyse-implementatie. Het is dezelfde
 * engine — `parseIngredientsText` → `collectEvidence` → `interpret` → `decide` —
 * met precies één verschil: er is geen product, dus er zijn geen certificaten en
 * er wordt niets opgeslagen.
 *
 * Dat verschil is inhoudelijk belangrijk en niet alleen technisch: zonder
 * product is er per definitie geen certificaatbewijs, dus deze route kan nooit
 * `CERTIFIED_HALAL` opleveren. Het beste wat eruit kan komen is "geen
 * aandachtspunt gevonden in de ingrediënten" — wat iets anders is dan de
 * uitspraak dat een product halal is. Die voorzichtigheid komt uit de engine
 * zelf en wordt hier niet omzeild.
 *
 * Niet persisteren is bewust. Een losse ingrediëntentekst hoort bij geen enkel
 * product, dus een `ProductAnalysis` zou nergens aan hangen en de historie
 * vervuilen. Zodra de gebruiker een product aanmaakt of koppelt, loopt de
 * gewone `analyzeProduct` alsnog.
 */
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";
import { analyzeIngredients, type AnalysisResult } from "@/server/halal/engine";
import type { HalalReference, ReferenceLoader } from "@/server/halal/engine/evidence";
import { referenceLoader as defaultReferenceLoader } from "@/server/repositories/referenceRepository";

export const MAX_INGREDIENT_TEXT_LENGTH = 5000;

export interface AnalyzeTextOptions {
  now?: Date;
  referenceLoader?: ReferenceLoader;
}

export interface TextAnalysisOutcome {
  analysis: AnalysisResult;
  /** Hoeveel losse ingrediënten uit de tekst gehaald zijn. */
  ingredientCount: number;
  /**
   * Waarschuwingen over de tekst zelf, niet over de ingrediënten. Bedoeld om
   * zichtbaar te maken wanneer de analyse niet over de volledige invoer ging.
   */
  warnings: string[];
}

/**
 * Schriftsoorten die de ingrediëntnormalisatie niet aankan.
 *
 * Dit is geen kosmetisch detail. `normalizeIngredientName` houdt alleen
 * Latijns schrift over, dus een Arabische of Cyrillische ingrediëntnaam
 * verdwijnt zonder spoor uit de geparste lijst. Bij een tweetalig etiket
 * (Frans + Arabisch, gangbaar op halal-producten) betekent dat: het Franse
 * deel wordt geanalyseerd, het Arabische deel wordt weggegooid, en er komt
 * "geen aandachtspunt gevonden" uit over een lijst die maar half gelezen is.
 *
 * Dat stil laten gebeuren is het slechtste van drie opties. De tekst goed
 * verwerken zou de beste zijn, maar dat is een uitbreiding van de parser uit
 * fase 3 en geen normalisatiekwestie. Tot die er is, wordt het in elk geval
 * GEMELD: de gebruiker krijgt te zien dat een deel van zijn tekst niet
 * meegenomen is, zodat "geen aandachtspunt" niet als volledig oordeel leest.
 */
const UNSUPPORTED_SCRIPT = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

export function unsupportedScriptWarning(text: string): string | null {
  if (!UNSUPPORTED_SCRIPT.test(text)) return null;
  return (
    "Een deel van de tekst staat in een schrift dat we nog niet kunnen lezen. " +
    "Die ingrediënten zijn niet meegenomen in deze analyse. " +
    "Typ ze eventueel zelf in het Nederlands, Frans of Engels over."
  );
}

export async function analyzeIngredientText(
  text: string,
  options: AnalyzeTextOptions = {},
): Promise<TextAnalysisOutcome> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Er is geen ingrediëntentekst opgegeven.", {
      details: { reason: "EMPTY_TEXT" },
    });
  }

  if (trimmed.length > MAX_INGREDIENT_TEXT_LENGTH) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      `De ingrediëntentekst is te lang (maximaal ${MAX_INGREDIENT_TEXT_LENGTH} tekens).`,
      { details: { reason: "TEXT_TOO_LONG" } },
    );
  }

  const parsedIngredients = parseIngredientsText(trimmed);

  if (parsedIngredients.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Uit deze tekst konden geen ingrediënten worden gehaald. Controleer of de ingrediënten met komma's gescheiden zijn.",
      { details: { reason: "NO_INGREDIENTS_PARSED" } },
    );
  }

  const loader = options.referenceLoader ?? defaultReferenceLoader;
  const reference: HalalReference = await loader.load();

  const analysis = analyzeIngredients(
    {
      parsedIngredients,
      hasIngredientsText: true,
      // Geen product betekent geen certificaten. Expliciet leeg, zodat er geen
      // twijfel over kan bestaan.
      certificates: [],
      productRevisionId: null,
    },
    reference,
    { now: options.now },
  );

  const warnings: string[] = [];
  const scriptWarning = unsupportedScriptWarning(trimmed);
  if (scriptWarning) warnings.push(scriptWarning);

  logger.info("PRODUCT_ANALYZED", {
    source: "TEXT",
    status: analysis.status,
    confidence: analysis.confidence,
    ingredientCount: parsedIngredients.length,
    warningCount: warnings.length,
    // Bewust geen ingrediëntentekst in de logs.
  });

  return { analysis, ingredientCount: parsedIngredients.length, warnings };
}
