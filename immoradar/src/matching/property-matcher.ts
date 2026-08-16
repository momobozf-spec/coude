/**
 * Property matching engine: decides whether a normalized listing refers to an
 * already-known physical property. Weighted signals with configurable
 * AUTO_MATCH / REVIEW / NO_MATCH thresholds. Low-confidence candidates are
 * never merged automatically.
 */

import type { NormalizedListing } from "@/domain/listing/types";
import type { MatchResult, PropertyCandidate } from "@/domain/property/types";

export interface PropertyMatchConfig {
  autoMatchThreshold: number; // >= → AUTO_MATCH
  reviewThreshold: number; // >= → REVIEW
  weights: {
    exactAddress: number;
    street: number;
    houseNumber: number;
    postalCode: number;
    city: number;
    surface: number;
    bedrooms: number;
    priceProximity: number;
    descriptionSimilarity: number;
    sellerPhone: number;
  };
}

export const DEFAULT_MATCH_CONFIG: PropertyMatchConfig = {
  autoMatchThreshold: 0.85,
  reviewThreshold: 0.6,
  weights: {
    exactAddress: 0.45,
    street: 0.12,
    houseNumber: 0.12,
    postalCode: 0.1,
    city: 0.05,
    surface: 0.08,
    bedrooms: 0.05,
    priceProximity: 0.08,
    descriptionSimilarity: 0.1,
    sellerPhone: 0.25,
  },
};

/** Jaccard similarity over word shingles — cheap, dependency-free. */
export function textSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function houseNumberCore(hn: string | null): string | null {
  if (!hn) return null;
  const m = hn.match(/^\d+/);
  return m ? m[0] : hn;
}

export function scorePropertyMatch(
  listing: NormalizedListing,
  candidate: PropertyCandidate,
  config: PropertyMatchConfig = DEFAULT_MATCH_CONFIG,
): { confidence: number; reasons: string[] } {
  const w = config.weights;
  const reasons: string[] = [];
  let score = 0;
  let maxScore = 0;

  const hasFullAddress =
    listing.street && listing.houseNumber && listing.postalCode &&
    candidate.street && candidate.houseNumber && candidate.postalCode;

  // Postal code is a hard gate: different postal codes can't be the same property
  if (listing.postalCode && candidate.postalCode && listing.postalCode !== candidate.postalCode) {
    return { confidence: 0, reasons: ["Different postal code"] };
  }

  if (hasFullAddress) {
    maxScore += w.exactAddress;
    const sameStreet = listing.street === candidate.street;
    const sameNumber = houseNumberCore(listing.houseNumber) === houseNumberCore(candidate.houseNumber);
    const samePc = listing.postalCode === candidate.postalCode;
    if (sameStreet && sameNumber && samePc) {
      score += w.exactAddress;
      reasons.push("Exact normalized address match");
    } else if (sameStreet && samePc) {
      score += w.exactAddress * 0.4;
      reasons.push("Same street and postal code, different house number");
    }
  } else {
    if (listing.street && candidate.street) {
      maxScore += w.street;
      if (listing.street === candidate.street) {
        score += w.street;
        reasons.push("Street match");
      }
    }
    if (listing.houseNumber && candidate.houseNumber) {
      maxScore += w.houseNumber;
      if (houseNumberCore(listing.houseNumber) === houseNumberCore(candidate.houseNumber)) {
        score += w.houseNumber;
        reasons.push("House number match");
      }
    }
    if (listing.postalCode && candidate.postalCode) {
      maxScore += w.postalCode;
      score += w.postalCode; // equality guaranteed by the gate above
      reasons.push("Postal code match");
    }
    if (listing.city && candidate.city) {
      maxScore += w.city;
      if (listing.city === candidate.city) {
        score += w.city;
        reasons.push("City match");
      }
    }
  }

  if (listing.surfaceArea && candidate.surfaceArea) {
    maxScore += w.surface;
    const ratio = Math.abs(listing.surfaceArea - candidate.surfaceArea) /
      Math.max(listing.surfaceArea, candidate.surfaceArea);
    if (ratio <= 0.03) {
      score += w.surface;
      reasons.push("Surface area match");
    } else if (ratio <= 0.1) {
      score += w.surface * 0.5;
      reasons.push("Surface area close");
    }
  }

  if (listing.bedrooms !== null && candidate.bedrooms !== null) {
    maxScore += w.bedrooms;
    if (listing.bedrooms === candidate.bedrooms) {
      score += w.bedrooms;
      reasons.push("Bedroom count match");
    }
  }

  if (listing.price && candidate.lastKnownPrice) {
    maxScore += w.priceProximity;
    const ratio = Math.abs(listing.price - candidate.lastKnownPrice) /
      Math.max(listing.price, candidate.lastKnownPrice);
    if (ratio <= 0.05) {
      score += w.priceProximity;
      reasons.push("Price proximity");
    } else if (ratio <= 0.15) {
      score += w.priceProximity * 0.5;
      reasons.push("Price within 15%");
    }
  }

  if (listing.description && candidate.lastDescription) {
    maxScore += w.descriptionSimilarity;
    const sim = textSimilarity(listing.description, candidate.lastDescription);
    if (sim >= 0.6) {
      score += w.descriptionSimilarity;
      reasons.push("High description similarity");
    } else if (sim >= 0.35) {
      score += w.descriptionSimilarity * 0.5;
      reasons.push("Moderate description similarity");
    }
  }

  if (listing.sellerPhone && candidate.sellerPhones && candidate.sellerPhones.length > 0) {
    maxScore += w.sellerPhone;
    if (candidate.sellerPhones.includes(listing.sellerPhone)) {
      score += w.sellerPhone;
      reasons.push("Seller phone match");
    }
  }

  if (maxScore === 0) return { confidence: 0, reasons: ["No comparable attributes"] };

  // Blend absolute weight collected with coverage-relative score so that a
  // full exact-address match dominates while sparse data stays conservative.
  const relative = score / maxScore;
  const confidence = Math.min(1, 0.6 * relative + 0.55 * score);
  return { confidence: Math.round(confidence * 100) / 100, reasons };
}

export function matchProperty(
  listing: NormalizedListing,
  candidates: PropertyCandidate[],
  config: PropertyMatchConfig = DEFAULT_MATCH_CONFIG,
): MatchResult {
  let best: { candidate: PropertyCandidate; confidence: number; reasons: string[] } | null = null;

  for (const candidate of candidates) {
    const { confidence, reasons } = scorePropertyMatch(listing, candidate, config);
    if (!best || confidence > best.confidence) {
      best = { candidate, confidence, reasons };
    }
  }

  if (!best || best.confidence < config.reviewThreshold) {
    return {
      confidence: best?.confidence ?? 0,
      reasons: best?.reasons ?? ["No candidates"],
      decision: "NO_MATCH",
    };
  }
  if (best.confidence >= config.autoMatchThreshold) {
    return {
      propertyId: best.candidate.id,
      confidence: best.confidence,
      reasons: best.reasons,
      decision: "AUTO_MATCH",
    };
  }
  return {
    propertyId: best.candidate.id,
    confidence: best.confidence,
    reasons: best.reasons,
    decision: "REVIEW",
  };
}
