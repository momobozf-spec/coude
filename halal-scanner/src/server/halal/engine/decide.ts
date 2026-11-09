/**
 * Stap 3: de finale beslissing.
 *
 * Deze module is puur, synchroon en deterministisch. Geen database, geen tijd,
 * geen willekeur, geen AI. Dezelfde interpretatie levert altijd exact dezelfde
 * beslissing op — en dat is precies wat je wilt van de functie die bepaalt of
 * iemand een product wel of niet koopt.
 *
 * Implementeert §3 en §5 van docs/DECISION-TREE.md. Waar die twee uit elkaar
 * lijken te lopen, wint het document; deze code is er de vertaling van, niet de
 * bron.
 */
import type { ConfidenceLevel, HalalStatus } from "@prisma/client";
import type { CertificateEvidence, IngredientFinding } from "@/types/halal";
import type { Decision, Interpretation } from "./types";

/**
 * Van slecht naar goed. De laagste status wint bij het samenvoegen — de regel
 * uit §3 van de beslisboom.
 */
const SEVERITY: Record<HalalStatus, number> = {
  HARAM: 5,
  LIKELY_HARAM: 4,
  MUSHBOOH: 3,
  UNKNOWN: 2,
  LIKELY_HALAL: 1,
  CERTIFIED_HALAL: 0,
};

/**
 * Boven dit aandeel onbekende ingrediënten is "waarschijnlijk halal" niet meer
 * eerlijk vol te houden en wordt het MUSHBOOH.
 *
 * De grens is een interne heuristiek, geen religieuze regel. Hij staat hier als
 * benoemde constante zodat hij zichtbaar en aanpasbaar is in plaats van
 * verstopt in een vergelijking.
 */
export const UNKNOWN_RATIO_MUSHBOOH_THRESHOLD = 0.34;

/** Onder dit aandeel onbekende ingrediënten blijft de confidence HIGH. */
export const UNKNOWN_RATIO_HIGH_CONFIDENCE_THRESHOLD = 0.1;

export function isWorse(a: HalalStatus, b: HalalStatus): boolean {
  return SEVERITY[a] > SEVERITY[b];
}

/**
 * De volgorde waarin bevindingen getoond worden.
 *
 * Deze staat vast en is niet afhankelijk van de volgorde waarin de database of
 * de parser dingen aanlevert: dezelfde input levert altijd dezelfde volgorde op.
 * De rangschikking volgt wat een gebruiker als eerste moet zien — een conflict
 * of een haram ingrediënt bovenaan, de bevestigingen onderaan.
 */
const FINDING_ORDER: Record<string, number> = {
  CONFLICT: 0,
  HARAM_INGREDIENT: 1,
  CERTIFICATE: 2,
  MUSHBOOH_INGREDIENT: 3,
  E_NUMBER: 4,
  MISSING_DATA: 5,
  UNKNOWN_INGREDIENT: 6,
  PRODUCT_LABEL: 7,
  HALAL_INGREDIENT: 8,
};

export function orderFindings(findings: readonly IngredientFinding[]): IngredientFinding[] {
  return [...findings]
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const rankA = FINDING_ORDER[a.finding.findingType] ?? 99;
      const rankB = FINDING_ORDER[b.finding.findingType] ?? 99;
      if (rankA !== rankB) return rankA - rankB;

      // Binnen dezelfde soort telt de ernst: een HARAM E-nummer boven een
      // twijfelachtig E-nummer.
      const severityDiff = SEVERITY[b.finding.status] - SEVERITY[a.finding.status];
      if (severityDiff !== 0) return severityDiff;

      // Laatste tiebreak op de oorspronkelijke etiketvolgorde. Zonder deze
      // regel zou de volgorde van gelijkwaardige bevindingen per run kunnen
      // wisselen, en dan is "dezelfde input, dezelfde output" niet waar.
      return a.index - b.index;
    })
    .map((entry) => entry.finding);
}

/** Een certificaat telt alleen mee als het actief is (§4 van de beslisboom). */
export function hasActiveCertificate(certificates: readonly CertificateEvidence[]): boolean {
  return certificates.some((certificate) => certificate.isActive);
}

/**
 * De uitkomst van uitsluitend de ingrediëntenanalyse, zonder certificaten.
 * Bewust apart: bij een conflict moeten we deze uitkomst nog kunnen benoemen,
 * ook al is de eindstatus een andere.
 */
export function summarizeIngredientStatus(interpretation: Interpretation): {
  status: HalalStatus;
  confidence: ConfidenceLevel;
} {
  const { findings, unknownCount, totalCount } = interpretation;

  if (totalCount === 0) {
    return { status: "UNKNOWN", confidence: "LOW" };
  }

  const decisive = findings.filter(
    (finding) => finding.status === "HARAM" || finding.status === "LIKELY_HARAM",
  );

  if (decisive.length > 0) {
    let worst: IngredientFinding = decisive[0]!;
    for (const finding of decisive) {
      if (isWorse(finding.status, worst.status)) worst = finding;
    }
    return { status: worst.status, confidence: worst.confidence };
  }

  const mushbooh = findings.filter((finding) => finding.status === "MUSHBOOH");
  if (mushbooh.length > 0) {
    // De hoogste zekerheid onder de twijfelgevallen: als één daarvan met
    // zekerheid twijfelachtig is, is de uitspraak "twijfelachtig" ook zeker.
    const confidence = bestConfidence(mushbooh.map((finding) => finding.confidence));
    return { status: "MUSHBOOH", confidence };
  }

  const unknownRatio = unknownCount / totalCount;

  if (unknownRatio >= UNKNOWN_RATIO_MUSHBOOH_THRESHOLD) {
    return { status: "MUSHBOOH", confidence: "LOW" };
  }

  if (unknownCount === 0) {
    return { status: "LIKELY_HALAL", confidence: "HIGH" };
  }

  return {
    status: "LIKELY_HALAL",
    confidence: unknownRatio <= UNKNOWN_RATIO_HIGH_CONFIDENCE_THRESHOLD ? "MEDIUM" : "LOW",
  };
}

function bestConfidence(levels: readonly ConfidenceLevel[]): ConfidenceLevel {
  if (levels.includes("HIGH")) return "HIGH";
  if (levels.includes("MEDIUM")) return "MEDIUM";
  return "LOW";
}

/**
 * De finale beslissing: ingrediëntenuitkomst gecombineerd met certificaten.
 *
 * De belangrijkste regel staat in §5 van de beslisboom en is hier één tak:
 * een geldig certificaat naast een (waarschijnlijk) haram ingrediënt levert
 * NOOIT automatisch CERTIFIED_HALAL op. Beide signalen zijn te betrouwbaar om
 * te negeren en geen van beide is betrouwbaar genoeg om de ander te overrulen.
 * Het eerlijke antwoord is MUSHBOOH plus een vlag voor menselijke verificatie.
 */
export function decide(
  interpretation: Interpretation,
  certificates: readonly CertificateEvidence[],
): Decision {
  const ingredientOutcome = summarizeIngredientStatus(interpretation);
  const findings: IngredientFinding[] = [...interpretation.findings];

  if (!hasActiveCertificate(certificates)) {
    return {
      status: ingredientOutcome.status,
      confidence: ingredientOutcome.confidence,
      hasConflict: false,
      needsHumanReview: false,
      findings: orderFindings(findings),
      summary: summaryFor(ingredientOutcome.status, interpretation, false),
    };
  }

  const activeCertificate = certificates.find((certificate) => certificate.isActive)!;

  const conflicts =
    ingredientOutcome.status === "HARAM" || ingredientOutcome.status === "LIKELY_HARAM";

  if (conflicts) {
    const offending = interpretation.findings.filter(
      (finding) => finding.status === "HARAM" || finding.status === "LIKELY_HARAM",
    );

    findings.unshift({
      findingType: "CONFLICT",
      status: "MUSHBOOH",
      confidence: "LOW",
      label: "Certificaat versus ingrediënten",
      rawLabel: null,
      reason:
        `Er is een geldig certificaat van ${activeCertificate.certificationBodyName}, maar in de ` +
        `ingrediëntenlijst staat ${offending.map((finding) => finding.label).join(", ")}. ` +
        "Deze twee spreken elkaar tegen. Daarom is de status niet automatisch halal en is " +
        "menselijke verificatie nodig.",
      ingredientId: null,
      eNumberId: null,
      eNumberCode: null,
      source: null,
    });

    return {
      status: "MUSHBOOH",
      confidence: "LOW",
      hasConflict: true,
      needsHumanReview: true,
      findings: orderFindings(findings),
      summary:
        "Het certificaat en de ingrediëntenlijst spreken elkaar tegen. Dit product is niet " +
        "automatisch als halal beoordeeld; een moderator kijkt hiernaar.",
    };
  }

  // Geen conflict: het certificaat is leidend. Bij twijfelgevallen blijft de
  // confidence bewust MEDIUM en blijven de twijfel-findings zichtbaar — de
  // gebruiker mag zien waarop de twijfel zat, ook als het certificaat wint.
  const confidence: ConfidenceLevel = ingredientOutcome.status === "MUSHBOOH" ? "MEDIUM" : "HIGH";

  findings.unshift({
    findingType: "CERTIFICATE",
    status: "CERTIFIED_HALAL",
    confidence,
    label: `Certificaat ${activeCertificate.certificateNumber}`,
    rawLabel: null,
    reason:
      `Geldig geverifieerd certificaat van ${activeCertificate.certificationBodyName}` +
      (activeCertificate.expiresAt ? `, geldig tot ${activeCertificate.expiresAt.slice(0, 10)}.` : "."),
    ingredientId: null,
    eNumberId: null,
    eNumberCode: null,
    source: null,
  });

  return {
    status: "CERTIFIED_HALAL",
    confidence,
    hasConflict: false,
    needsHumanReview: false,
    findings: orderFindings(findings),
    summary: summaryFor("CERTIFIED_HALAL", interpretation, true),
  };
}

function summaryFor(
  status: HalalStatus,
  interpretation: Interpretation,
  certified: boolean,
): string {
  const { unknownCount, totalCount } = interpretation;

  switch (status) {
    case "CERTIFIED_HALAL":
      return interpretation.findings.some((finding) => finding.status === "MUSHBOOH")
        ? "Er is een geldig halal-certificaat. Van enkele ingrediënten is de herkomst uit de " +
            "etiketgegevens niet vast te stellen; die staan hieronder vermeld."
        : "Er is een geldig halal-certificaat van een geregistreerde certificerende instantie.";
    case "HARAM":
      return "In de ingrediëntenlijst staat een ingrediënt dat niet halal is.";
    case "LIKELY_HARAM":
      return "Er is een sterke aanwijzing voor een niet-halal ingrediënt, zonder harde bevestiging.";
    case "MUSHBOOH":
      return unknownCount > 0
        ? `Van ${unknownCount} van de ${totalCount} ingrediënten is de herkomst niet vast te stellen.`
        : "Van een of meer ingrediënten kan de herkomst dierlijk zijn. Dat is uit de " +
            "etiketgegevens niet te bepalen.";
    case "LIKELY_HALAL":
      return certified
        ? "Geen problematische ingrediënten gevonden."
        : unknownCount > 0
          ? `Geen problematische ingrediënten gevonden. Van ${unknownCount} van de ${totalCount} ` +
            "ingrediënten is niets bekend; er is geen certificaat dat dit bevestigt."
          : "Alle ingrediënten zijn bekend en onproblematisch. Er is geen certificaat dat dit bevestigt.";
    case "UNKNOWN":
      return "Er is geen ingrediëntenlijst beschikbaar voor dit product.";
    default:
      return "";
  }
}
