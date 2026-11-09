/**
 * De rules engine, aan elkaar geknoopt.
 *
 *   collectEvidence  →  interpret  →  decide
 *   (feiten)            (per ingrediënt)  (per product, deterministisch)
 *
 * `analyzeIngredients` is puur: geef dezelfde input en referentiedata, en je
 * krijgt gegarandeerd dezelfde analyse. Dat is wat `inputHash` in
 * `ProductAnalysis` bruikbaar maakt — dezelfde hash bij dezelfde engineVersie
 * betekent dat opnieuw draaien niets kan opleveren.
 */
import { createHash } from "node:crypto";
import type { HalalAnalysis } from "@/types/halal";
import { collectEvidence, type EvidenceInput, type HalalReference } from "./evidence";
import { interpret } from "./interpret";
import { decide } from "./decide";
import type { Decision, Evidence, Interpretation } from "./types";
import { ENGINE_VERSION } from "./version";

export { ENGINE_VERSION };

export interface AnalysisResult extends HalalAnalysis {
  needsHumanReview: boolean;
  inputHash: string;
  productRevisionId: string | null;
}

/**
 * Stabiele hash over precies datgene wat de uitkomst kan beïnvloeden.
 *
 * WAT ERIN ZIT — en waarom:
 *
 *  - `ingredients`: de genormaliseerde namen, in etiketvolgorde. Volgorde telt
 *    mee omdat etiketten op afnemend gewicht gesorteerd zijn; dezelfde set in
 *    een andere volgorde is een ander etiket.
 *  - `eNumbers`: de herkende E-nummercodes per positie. Staat apart van de naam
 *    omdat "E471" en "emulgator E471" dezelfde code opleveren maar een andere
 *    genormaliseerde naam — en de code is wat de beslissing draagt.
 *  - `hasText`: het verschil tussen "lege lijst" en "geen lijst" is het verschil
 *    tussen MUSHBOOH en UNKNOWN.
 *  - `certificates`: id plus of het certificaat actief is, gesorteerd. Een
 *    certificaat dat verloopt moet een nieuwe analyse forceren, ook als de
 *    ingrediënten identiek bleven. Gesorteerd omdat de volgorde waarin de
 *    database ze teruggeeft niet gegarandeerd is.
 *
 * WAT ER BEWUST NIET IN ZIT: alles wat wisselt zonder de uitkomst te veranderen
 * — `requestId`, `lastViewedAt`, `createdAt` van het verzoek, scanteller,
 * `updatedAt` van het product. Zou daar ook maar één van in zitten, dan is elke
 * hash uniek en is de cache waardeloos.
 */
export function computeInputHash(input: EvidenceInput): string {
  const canonical = JSON.stringify({
    ingredients: input.parsedIngredients.map((item) => item.normalizedName),
    eNumbers: input.parsedIngredients.map((item) => item.eNumberCode ?? null),
    hasText: input.hasIngredientsText,
    certificates: [...input.certificates]
      .map((certificate) => `${certificate.certificateId}:${certificate.isActive ? 1 : 0}`)
      .sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** De volledige analyse. Puur: geen database, geen netwerk, geen willekeur. */
export function analyzeIngredients(
  input: EvidenceInput,
  reference: HalalReference,
  options: { now?: Date } = {},
): AnalysisResult {
  const evidence: Evidence = collectEvidence(input, reference);
  const interpretation: Interpretation = interpret(evidence);
  const decision: Decision = decide(interpretation, evidence.certificates);

  const sources = collectSources(decision);

  return {
    status: decision.status,
    confidence: decision.confidence,
    summary: decision.summary,
    findings: decision.findings,
    certificateEvidence: evidence.certificates,
    sources,
    hasConflict: decision.hasConflict,
    needsHumanReview: decision.needsHumanReview,
    engineVersion: ENGINE_VERSION,
    analyzedAt: (options.now ?? new Date()).toISOString(),
    inputHash: computeInputHash(input),
    productRevisionId: evidence.productRevisionId,
  };
}

/** Unieke bronnen achter de bevindingen, in de volgorde waarin ze voorkomen. */
function collectSources(decision: Decision): HalalAnalysis["sources"] {
  const seen = new Set<string>();
  const sources: HalalAnalysis["sources"] = [];

  for (const finding of decision.findings) {
    if (!finding.source || seen.has(finding.source.id)) continue;
    seen.add(finding.source.id);
    sources.push(finding.source);
  }

  return sources;
}

export { collectEvidence, interpret, decide };
export type { EvidenceInput, HalalReference } from "./evidence";
export type { Decision, Evidence, Interpretation } from "./types";
