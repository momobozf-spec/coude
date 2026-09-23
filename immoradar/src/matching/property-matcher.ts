import type { MatchDecision } from "@/generated/prisma/enums";
import type { MatchResult, MatchThresholds } from "@/domain/property/match-result";
import { DEFAULT_MATCH_THRESHOLDS } from "@/domain/property/match-result";
import { jaccard } from "./text-similarity";

/**
 * The subset of a listing used for matching. Both the incoming listing and the
 * candidate properties are expressed in this shape so the scorer is symmetric.
 */
export interface MatchSubject {
  addressKey: string | null;
  street: string | null; // normalized
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null; // canonical
  surfaceArea: number | null;
  bedrooms: number | null;
  price: number | null;
  description: string | null;
  sellerPhone: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PropertyCandidate extends MatchSubject {
  propertyId: string;
}

export interface MatchWeights {
  exactAddress: number;
  streetAndPostal: number;
  streetAndNumberNoPostal: number;
  postalOnly: number;
  cityOnly: number;
  surfaceExact: number;
  surfaceClose: number;
  bedrooms: number;
  priceClose: number;
  description: number;
  sellerPhone: number;
  geoClose: number;
  /** Penalty when house numbers are known and differ. */
  houseNumberConflict: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  exactAddress: 0.75,
  streetAndPostal: 0.3,
  streetAndNumberNoPostal: 0.25,
  postalOnly: 0.05,
  cityOnly: 0.02,
  surfaceExact: 0.15,
  surfaceClose: 0.1,
  bedrooms: 0.08,
  priceClose: 0.08,
  description: 0.15,
  sellerPhone: 0.25,
  geoClose: 0.15,
  houseNumberConflict: -0.6,
};

export interface CandidateScore {
  propertyId: string;
  confidence: number;
  reasons: string[];
}

function pctDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(a, b);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function scoreCandidate(subject: MatchSubject, candidate: PropertyCandidate, weights: MatchWeights = DEFAULT_MATCH_WEIGHTS): CandidateScore {
  const reasons: string[] = [];
  let score = 0;

  const exactAddress = !!subject.addressKey && subject.addressKey === candidate.addressKey;
  if (exactAddress) {
    score += weights.exactAddress;
    reasons.push("Exact normalized address match");
  } else {
    const sameStreet = !!subject.street && subject.street === candidate.street;
    const samePostal = !!subject.postalCode && subject.postalCode === candidate.postalCode;
    const sameNumber = !!subject.houseNumber && subject.houseNumber === candidate.houseNumber;
    const numberConflict = !!subject.houseNumber && !!candidate.houseNumber && subject.houseNumber !== candidate.houseNumber;
    if (sameStreet && samePostal) {
      score += weights.streetAndPostal;
      reasons.push("Same street and postal code");
      if (numberConflict) {
        score += weights.houseNumberConflict;
        reasons.push("House number conflict");
      }
    } else if (sameStreet && sameNumber) {
      score += weights.streetAndNumberNoPostal;
      reasons.push("Same street and house number");
    } else if (samePostal) {
      score += weights.postalOnly;
      reasons.push("Same postal code");
    } else if (subject.city && subject.city === candidate.city) {
      score += weights.cityOnly;
      reasons.push("Same city");
    }
  }

  if (subject.surfaceArea && candidate.surfaceArea) {
    if (subject.surfaceArea === candidate.surfaceArea) {
      score += weights.surfaceExact;
      reasons.push("Identical surface area");
    } else if (pctDiff(subject.surfaceArea, candidate.surfaceArea) <= 0.05) {
      score += weights.surfaceClose;
      reasons.push("Surface area within 5%");
    }
  }

  if (subject.bedrooms !== null && candidate.bedrooms !== null && subject.bedrooms === candidate.bedrooms) {
    score += weights.bedrooms;
    reasons.push("Same number of bedrooms");
  }

  if (subject.price && candidate.price && pctDiff(subject.price, candidate.price) <= 0.1) {
    score += weights.priceClose;
    reasons.push("Price within 10%");
  }

  const sim = jaccard(subject.description, candidate.description);
  if (sim >= 0.6) {
    score += weights.description;
    reasons.push(`Description similarity ${(sim * 100).toFixed(0)}%`);
  } else if (sim >= 0.4) {
    score += weights.description / 2;
    reasons.push(`Partial description similarity ${(sim * 100).toFixed(0)}%`);
  }

  if (subject.sellerPhone && subject.sellerPhone === candidate.sellerPhone) {
    score += weights.sellerPhone;
    reasons.push("Same seller phone number");
  }

  if (
    subject.latitude != null &&
    subject.longitude != null &&
    candidate.latitude != null &&
    candidate.longitude != null
  ) {
    const d = haversineMeters(subject.latitude, subject.longitude, candidate.latitude, candidate.longitude);
    if (d <= 30) {
      score += weights.geoClose;
      reasons.push("Coordinates within 30m");
    }
  }

  return { propertyId: candidate.propertyId, confidence: Math.max(0, Math.min(1, Number(score.toFixed(3)))), reasons };
}

export function decisionFor(confidence: number, thresholds: MatchThresholds = DEFAULT_MATCH_THRESHOLDS): MatchDecision {
  if (confidence >= thresholds.autoMatch) return "AUTO_MATCH";
  if (confidence >= thresholds.review) return "REVIEW";
  return "NO_MATCH";
}

/**
 * Pick the best candidate. Low-confidence matches are never auto-merged: the
 * caller creates a new Property for REVIEW/NO_MATCH and records the candidate
 * for a human to review.
 */
export function matchProperty(
  subject: MatchSubject,
  candidates: PropertyCandidate[],
  thresholds: MatchThresholds = DEFAULT_MATCH_THRESHOLDS,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchResult {
  if (!candidates.length) return { confidence: 0, reasons: ["No candidate properties"], decision: "NO_MATCH" };
  let best: CandidateScore | null = null;
  for (const c of candidates) {
    const s = scoreCandidate(subject, c, weights);
    if (!best || s.confidence > best.confidence) best = s;
  }
  if (!best) return { confidence: 0, reasons: [], decision: "NO_MATCH" };
  const decision = decisionFor(best.confidence, thresholds);
  return {
    propertyId: decision === "NO_MATCH" ? undefined : best.propertyId,
    confidence: best.confidence,
    reasons: best.reasons,
    decision,
  };
}
