/**
 * CRM ↔ market matching: given a market opportunity (listing + property),
 * find whether the agency's CRM knows the seller. Confidence-based; a common
 * name alone can never produce a match — name evidence only counts combined
 * with corroborating location evidence.
 */

import type { CrmMatchCandidate, CrmMatchResult } from "@/domain/contact/types";

export interface CrmMarketMatchInput {
  sellerPhone: string | null; // E.164
  sellerEmail: string | null;
  sellerName: string | null; // raw name from listing
  normalizedSellerName: string | null;
  propertyId: string | null;
  propertyPostalCode: string | null;
  propertyStreet: string | null;
  propertyHouseNumber: string | null;
}

export interface CrmMatchConfig {
  matchThreshold: number; // confidence >= → crmMatch true
}

export const DEFAULT_CRM_MATCH_CONFIG: CrmMatchConfig = {
  matchThreshold: 0.75,
};

interface Evidence {
  weight: number;
  reason: string;
  /** Evidence strong enough to establish identity on its own */
  standalone: boolean;
}

function collectEvidence(input: CrmMarketMatchInput, contact: CrmMatchCandidate): Evidence[] {
  const evidence: Evidence[] = [];

  if (input.sellerPhone && contact.normalizedPhone && input.sellerPhone === contact.normalizedPhone) {
    evidence.push({ weight: 0.9, reason: "Exact normalized phone match", standalone: true });
  }
  if (input.sellerEmail && contact.normalizedEmail && input.sellerEmail === contact.normalizedEmail) {
    evidence.push({ weight: 0.85, reason: "Exact email match", standalone: true });
  }

  // Known relationship between this contact and the physical property
  if (input.propertyId && contact.relatedPropertyIds?.includes(input.propertyId)) {
    evidence.push({ weight: 0.8, reason: "Known relationship with this property", standalone: true });
  }

  const nameMatches =
    input.normalizedSellerName !== null &&
    contact.normalizedName !== null &&
    input.normalizedSellerName === contact.normalizedName;

  if (nameMatches) {
    // Name is NEVER standalone — needs corroboration
    evidence.push({ weight: 0.45, reason: "Normalized name match", standalone: false });

    if (
      input.propertyPostalCode &&
      contact.postalCode &&
      input.propertyPostalCode === contact.postalCode
    ) {
      evidence.push({ weight: 0.3, reason: "Matching property postcode", standalone: false });
    }
    if (
      input.propertyStreet &&
      contact.address &&
      contact.address.toLowerCase().includes(input.propertyStreet.toLowerCase())
    ) {
      evidence.push({ weight: 0.35, reason: "Contact address matches property street", standalone: false });
    }
  }

  return evidence;
}

export function matchCrmContact(
  input: CrmMarketMatchInput,
  candidates: CrmMatchCandidate[],
  config: CrmMatchConfig = DEFAULT_CRM_MATCH_CONFIG,
): CrmMatchResult {
  let best: { contact: CrmMatchCandidate; confidence: number; reasons: string[] } | null = null;

  for (const contact of candidates) {
    const evidence = collectEvidence(input, contact);
    if (evidence.length === 0) continue;

    const hasStandalone = evidence.some((e) => e.standalone);
    const corroborated = evidence.length >= 2;
    // A lone non-standalone signal (e.g. only a name) can never match
    if (!hasStandalone && !corroborated) continue;

    // Noisy-or combination keeps confidence in [0,1) and rewards convergence
    let confidence = 1;
    for (const e of evidence) confidence *= 1 - e.weight;
    confidence = 1 - confidence;

    // Cap purely circumstantial (non-standalone) matches below certainty
    if (!hasStandalone) confidence = Math.min(confidence, 0.8);

    const reasons = evidence.map((e) => e.reason);
    if (!best || confidence > best.confidence) {
      best = { contact, confidence: Math.round(confidence * 100) / 100, reasons };
    }
  }

  if (!best || best.confidence < config.matchThreshold) {
    return { crmMatch: false, confidence: best?.confidence ?? 0, reasons: best?.reasons ?? [] };
  }
  return {
    crmMatch: true,
    confidence: best.confidence,
    contactId: best.contact.id,
    reasons: best.reasons,
  };
}
