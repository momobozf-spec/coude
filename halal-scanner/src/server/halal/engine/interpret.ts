/**
 * Stap 2: feiten omzetten naar bevindingen.
 *
 * Puur en synchroon. Deze module oordeelt uitsluitend PER INGREDIËNT en raakt
 * de productstatus niet aan — dat is stap 3. Wat hier uitkomt is precies wat de
 * gebruiker onder "Waarom deze beoordeling?" te zien krijgt, dus elke bevinding
 * heeft een reden in gewone taal en waar mogelijk een bron.
 *
 * Implementeert §2 van docs/DECISION-TREE.md.
 */
import type { FindingType, HalalStatus } from "@prisma/client";
import type { IngredientFinding } from "@/types/halal";
import type { Evidence, EvidenceToken, IngredientMatch, Interpretation } from "./types";

/**
 * Woorden die de herkomst expliciet op het etiket vastleggen.
 *
 * §2 van de beslisboom: "vermelde herkomst overrulet de standaard". Kaal
 * "E471" is twijfelachtig omdat de herkomst dierlijk kán zijn; "plantaardige
 * mono- en diglyceriden" is dat niet, want daar staat het antwoord al bij.
 *
 * Bewust alleen plantaardige/synthetische kwalificaties. Een dierlijke
 * kwalificatie ("varkensgelatine") hoort een eigen referentierecord te zijn en
 * wordt via de langste-match-regel gevonden — niet via woordherkenning, want
 * daar mag geen enkele verkeerde gok in sluipen.
 */
const PLANT_ORIGIN_QUALIFIERS = [
  "plantaardig",
  "plantaardige",
  "vegetal",
  "vegetale",
  "vegetable",
  "plant based",
  "plantbased",
  "vegan",
  "veganistisch",
  "synthetisch",
  "synthetische",
];

export function hasPlantOriginQualifier(token: string): boolean {
  return PLANT_ORIGIN_QUALIFIERS.some((qualifier) => token.includes(qualifier));
}

function findingTypeFor(status: HalalStatus, isENumber: boolean): FindingType {
  if (isENumber) return "E_NUMBER";
  switch (status) {
    case "HARAM":
    case "LIKELY_HARAM":
      return "HARAM_INGREDIENT";
    case "MUSHBOOH":
      return "MUSHBOOH_INGREDIENT";
    case "UNKNOWN":
      return "UNKNOWN_INGREDIENT";
    default:
      return "HALAL_INGREDIENT";
  }
}

/**
 * De specifiekste match wint.
 *
 * "varkensgelatine" moet het HARAM-record raken en niet het MUSHBOOH-record
 * "gelatine". Omdat een specifiekere term per definitie langer is, is de
 * langste matchende referentieterm de juiste. Bij gelijke lengte wint een
 * exacte match op de hoofdnaam boven een alias, zodat de uitkomst niet van de
 * volgorde uit de database afhangt — determinisme is hier belangrijker dan
 * elegantie.
 */
export function pickMostSpecific(matches: readonly IngredientMatch[]): IngredientMatch | undefined {
  if (matches.length === 0) return undefined;

  const kindRank: Record<IngredientMatch["matchKind"], number> = {
    exact: 2,
    alias: 1,
    contains: 0,
  };

  return [...matches].sort((a, b) => {
    if (b.matchedText.length !== a.matchedText.length) {
      return b.matchedText.length - a.matchedText.length;
    }
    if (kindRank[b.matchKind] !== kindRank[a.matchKind]) {
      return kindRank[b.matchKind] - kindRank[a.matchKind];
    }
    // Laatste tiebreak op id: zonder deze regel zou de uitkomst kunnen
    // wisselen tussen twee runs met dezelfde data.
    return a.reference.id.localeCompare(b.reference.id);
  })[0];
}

function interpretToken(token: EvidenceToken): IngredientFinding {
  // E-nummers eerst: een herkend E-nummer is preciezer dan welke naamsmatch ook.
  const eNumber = token.eNumberMatches[0];
  if (eNumber) {
    const plantQualified =
      hasPlantOriginQualifier(token.normalized) &&
      eNumber.reference.plantDerivedPossible &&
      eNumber.reference.defaultStatus === "MUSHBOOH";

    const status: HalalStatus = plantQualified ? "LIKELY_HALAL" : eNumber.reference.defaultStatus;

    return {
      findingType: findingTypeFor(status, true),
      status,
      confidence: plantQualified ? "MEDIUM" : eNumber.reference.defaultConfidence,
      label: `${eNumber.reference.code} (${eNumber.reference.name})`,
      rawLabel: token.raw,
      reason: plantQualified
        ? `Op het etiket staat een plantaardige herkomst vermeld. Zonder die vermelding is ` +
          `${eNumber.reference.code} twijfelachtig, omdat het ook dierlijk kan zijn.`
        : reasonForENumber(eNumber.reference.defaultStatus, eNumber.reference),
      ingredientId: null,
      eNumberId: eNumber.reference.id,
      eNumberCode: eNumber.reference.code,
      source: eNumber.reference.source,
    };
  }

  const match = pickMostSpecific(token.ingredientMatches);
  if (match) {
    const plantQualified =
      hasPlantOriginQualifier(token.normalized) &&
      match.reference.originRisk === "ANIMAL_POSSIBLE" &&
      match.reference.defaultStatus === "MUSHBOOH";

    const status: HalalStatus = plantQualified ? "LIKELY_HALAL" : match.reference.defaultStatus;

    return {
      findingType: findingTypeFor(status, false),
      status,
      confidence: plantQualified ? "MEDIUM" : match.reference.defaultConfidence,
      label: match.reference.name,
      rawLabel: token.raw,
      reason: plantQualified
        ? "Op het etiket staat een plantaardige herkomst vermeld. Zonder die vermelding zou dit " +
          "ingrediënt twijfelachtig zijn omdat het ook dierlijk kan zijn."
        : reasonForIngredient(match),
      ingredientId: match.reference.id,
      eNumberId: null,
      eNumberCode: match.reference.eNumberCode,
      source: match.reference.source,
    };
  }

  return {
    findingType: "UNKNOWN_INGREDIENT",
    status: "UNKNOWN",
    confidence: "LOW",
    label: token.raw,
    rawLabel: token.raw,
    reason:
      "Dit ingrediënt staat niet in onze referentiedatabase. Daardoor kunnen we de herkomst " +
      "niet vaststellen.",
    ingredientId: null,
    eNumberId: null,
    eNumberCode: null,
    source: null,
  };
}

function reasonForIngredient(match: IngredientMatch): string {
  const { reference } = match;
  switch (reference.defaultStatus) {
    case "HARAM":
      return `${reference.name} is niet halal.`;
    case "LIKELY_HARAM":
      return `${reference.name} is vrijwel zeker niet halal, maar dat is niet met zekerheid vast te stellen.`;
    case "MUSHBOOH":
      return reference.originRisk === "ALCOHOL_RELATED"
        ? `${reference.name} is alcoholgerelateerd; of dat een bezwaar is hangt af van de toepassing.`
        : `De herkomst van ${reference.name} kan dierlijk zijn en staat niet op het etiket.`;
    case "LIKELY_HALAL":
    case "CERTIFIED_HALAL":
      return `${reference.name} is onproblematisch.`;
    default:
      return `Over ${reference.name} is niet genoeg bekend om een uitspraak te doen.`;
  }
}

function reasonForENumber(
  status: HalalStatus,
  reference: { code: string; name: string; animalDerivedPossible: boolean },
): string {
  switch (status) {
    case "HARAM":
      return `${reference.code} (${reference.name}) is niet halal.`;
    case "LIKELY_HARAM":
      return `${reference.code} is vrijwel zeker niet halal.`;
    case "MUSHBOOH":
      return reference.animalDerivedPossible
        ? `${reference.code} kan van dierlijke herkomst zijn. Het etiket vermeldt de herkomst niet.`
        : `De herkomst van ${reference.code} is niet vast te stellen.`;
    case "LIKELY_HALAL":
      return `${reference.code} is onproblematisch.`;
    default:
      return `Over ${reference.code} is niet genoeg bekend om een uitspraak te doen.`;
  }
}

export function interpret(evidence: Evidence): Interpretation {
  if (!evidence.hasIngredientsText || evidence.tokens.length === 0) {
    return {
      findings: [
        {
          findingType: "MISSING_DATA",
          status: "UNKNOWN",
          confidence: "LOW",
          label: "Geen ingrediëntenlijst",
          rawLabel: null,
          reason:
            "Voor dit product is geen ingrediëntenlijst beschikbaar. Voeg een foto van het " +
            "etiket toe om een beoordeling mogelijk te maken.",
          ingredientId: null,
          eNumberId: null,
          eNumberCode: null,
          source: null,
        },
      ],
      unknownCount: 0,
      totalCount: 0,
    };
  }

  const findings = evidence.tokens.map(interpretToken);

  return {
    findings,
    unknownCount: findings.filter((finding) => finding.findingType === "UNKNOWN_INGREDIENT").length,
    totalCount: findings.length,
  };
}
