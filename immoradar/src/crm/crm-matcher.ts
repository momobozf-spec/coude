import type { CrmMatchResult } from "@/domain/contact/types";
import { stringSimilarity } from "@/matching/text-similarity";

/** The market-side signal we try to link to a CRM contact. */
export interface MarketSubject {
  sellerPhone: string | null; // E.164
  sellerEmail: string | null;
  sellerNormalizedName: string | null;
  addressKey: string | null;
  postalCode: string | null;
  propertyId: string | null;
}

/** A tenant's CRM contact, already normalized. */
export interface CrmCandidate {
  contactId: string;
  normalizedPhone: string | null;
  normalizedEmail: string | null;
  normalizedName: string | null;
  normalizedAddressKey: string | null;
  postalCode: string | null;
  /** Address keys / property ids from ContactPropertyRelationship rows. */
  relationshipAddressKeys: string[];
  relationshipPropertyIds: string[];
}

export interface CrmMatchWeights {
  phone: number;
  email: number;
  propertyRelationship: number;
  addressExact: number;
  nameExact: number;
  nameFuzzy: number;
  postalCode: number;
}

export const DEFAULT_CRM_MATCH_WEIGHTS: CrmMatchWeights = {
  phone: 0.9,
  email: 0.85,
  propertyRelationship: 0.8,
  addressExact: 0.75,
  nameExact: 0.35,
  nameFuzzy: 0.2,
  postalCode: 0.08,
};

export const CRM_MATCH_THRESHOLD = 0.6;

export interface ScoredCrmCandidate {
  contactId: string;
  confidence: number;
  reasons: string[];
}

export function scoreCrmCandidate(subject: MarketSubject, candidate: CrmCandidate, w: CrmMatchWeights = DEFAULT_CRM_MATCH_WEIGHTS): ScoredCrmCandidate {
  const reasons: string[] = [];
  let score = 0;
  let identityHit = false;

  if (subject.sellerPhone && candidate.normalizedPhone && subject.sellerPhone === candidate.normalizedPhone) {
    score += w.phone;
    identityHit = true;
    reasons.push("Exact normalized phone match");
  }
  if (subject.sellerEmail && candidate.normalizedEmail && subject.sellerEmail === candidate.normalizedEmail) {
    score += w.email;
    identityHit = true;
    reasons.push("Exact email match");
  }
  if (subject.propertyId && candidate.relationshipPropertyIds.includes(subject.propertyId)) {
    score += w.propertyRelationship;
    identityHit = true;
    reasons.push("Historical relationship with this property");
  } else if (subject.addressKey && candidate.relationshipAddressKeys.includes(subject.addressKey)) {
    score += w.propertyRelationship;
    identityHit = true;
    reasons.push("Historical relationship with this property address");
  } else if (subject.addressKey && candidate.normalizedAddressKey && subject.addressKey === candidate.normalizedAddressKey) {
    score += w.addressExact;
    identityHit = true;
    reasons.push("Contact address matches the property address");
  }

  if (subject.sellerNormalizedName && candidate.normalizedName) {
    if (subject.sellerNormalizedName === candidate.normalizedName) {
      score += w.nameExact;
      reasons.push("Matching normalized name");
    } else if (stringSimilarity(subject.sellerNormalizedName, candidate.normalizedName) >= 0.85) {
      score += w.nameFuzzy;
      reasons.push("Similar name");
    }
  }
  if (subject.postalCode && candidate.postalCode && subject.postalCode === candidate.postalCode) {
    score += w.postalCode;
    reasons.push("Matching property postcode");
  }

  // A name alone (even with postcode) is never enough: common names collide.
  if (!identityHit) score = Math.min(score, CRM_MATCH_THRESHOLD - 0.05);

  return { contactId: candidate.contactId, confidence: Number(Math.min(1, score).toFixed(2)), reasons };
}

/**
 * Find the best CRM contact for a market signal. Candidates MUST already be
 * filtered to a single tenant by the caller (repository layer).
 */
export function matchCrmContact(subject: MarketSubject, candidates: CrmCandidate[], threshold = CRM_MATCH_THRESHOLD): CrmMatchResult {
  let best: ScoredCrmCandidate | null = null;
  for (const c of candidates) {
    const s = scoreCrmCandidate(subject, c);
    if (!best || s.confidence > best.confidence) best = s;
  }
  if (!best || best.confidence < threshold) {
    return { crmMatch: false, confidence: best?.confidence ?? 0, contactId: null, reasons: best?.reasons ?? [] };
  }
  return { crmMatch: true, confidence: best.confidence, contactId: best.contactId, reasons: best.reasons };
}
