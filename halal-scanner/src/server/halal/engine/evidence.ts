/**
 * Stap 1: feiten verzamelen.
 *
 * Deze module bevat geen enkel oordeel. Hij zoekt op welke referentierecords bij
 * de etiketttermen horen en welke certificaten er hangen — meer niet. Of een
 * match "erg" is, beslist stap 2; wat het voor het product betekent, stap 3.
 *
 * De matching gebeurt in het geheugen tegen een geladen momentopname van de
 * referentietabel. Dat mag: die tabel is een zorgvuldig samengestelde lijst van
 * enkele honderden ingrediënten en E-nummers, geen gebruikersdata. Het levert
 * twee dingen op die met SQL lastig zijn: de langste-match-regel is triviaal, en
 * de matching is volledig testbaar zonder database.
 */
import type { ParsedIngredient } from "@/types/product";
import type { CertificateEvidence } from "@/types/halal";
import type {
  ENumberReference,
  Evidence,
  EvidenceToken,
  IngredientMatch,
  IngredientReference,
} from "./types";

/** Momentopname van de referentietabellen. */
export interface HalalReference {
  ingredients: IngredientReference[];
  eNumbers: ENumberReference[];
}

/** Waar de referentiedata vandaan komt. Geïmplementeerd door de Prisma-adapter. */
export interface ReferenceLoader {
  load(): Promise<HalalReference>;
}

export interface EvidenceInput {
  parsedIngredients: readonly ParsedIngredient[];
  hasIngredientsText: boolean;
  certificates: readonly CertificateEvidence[];
  productRevisionId?: string | null;
}

/** Woordgrens-bewuste bevatting: "gelatine" zit in "runder gelatine", niet in "gelatinepoeder". */
function containsAsWord(haystack: string, needle: string): boolean {
  const index = haystack.indexOf(needle);
  if (index < 0) return false;
  const before = index === 0 ? " " : haystack[index - 1]!;
  const afterIndex = index + needle.length;
  const after = afterIndex >= haystack.length ? " " : haystack[afterIndex]!;
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

/**
 * Alle referentierecords die bij deze etiketterm passen.
 *
 * Bewust álle matches, niet de beste: welke wint is een interpretatiebeslissing
 * en hoort niet in de verzamelstap.
 */
export function matchIngredients(
  token: string,
  rawToken: string,
  references: readonly IngredientReference[],
): IngredientMatch[] {
  const matches: IngredientMatch[] = [];

  for (const reference of references) {
    if (reference.normalizedName === token) {
      matches.push({ token, rawToken, matchedText: reference.normalizedName, matchKind: "exact", reference });
      continue;
    }

    const alias = reference.aliases.find((candidate) => candidate === token);
    if (alias) {
      matches.push({ token, rawToken, matchedText: alias, matchKind: "alias", reference });
      continue;
    }

    // Samenstellingen: "runder gelatine" moet het record "gelatine" raken.
    const contained = [reference.normalizedName, ...reference.aliases]
      .filter((candidate) => candidate.length >= 4 && containsAsWord(token, candidate))
      .sort((a, b) => b.length - a.length)[0];

    if (contained) {
      matches.push({ token, rawToken, matchedText: contained, matchKind: "contains", reference });
    }
  }

  return matches;
}

export function collectEvidence(input: EvidenceInput, reference: HalalReference): Evidence {
  const eNumbersByCode = new Map(reference.eNumbers.map((entry) => [entry.code.toUpperCase(), entry]));

  const tokens: EvidenceToken[] = input.parsedIngredients.map((parsed) => {
    const code = parsed.eNumberCode?.toUpperCase() ?? null;
    const eNumberReference = code ? eNumbersByCode.get(code) : undefined;

    return {
      raw: parsed.rawName,
      normalized: parsed.normalizedName,
      eNumberCode: code,
      ingredientMatches: matchIngredients(parsed.normalizedName, parsed.rawName, reference.ingredients),
      eNumberMatches: eNumberReference
        ? [{ token: parsed.normalizedName, rawToken: parsed.rawName, reference: eNumberReference }]
        : [],
    } satisfies EvidenceToken;
  });

  return {
    hasIngredientsText: input.hasIngredientsText,
    tokens,
    certificates: [...input.certificates],
    productRevisionId: input.productRevisionId ?? null,
  };
}

export type { ENumberReference, IngredientReference };
