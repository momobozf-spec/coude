/**
 * Deterministic seller classification: PRIVATE / PROFESSIONAL / UNKNOWN.
 * Rule-based first; the interface leaves room for an optional AI classifier
 * later (see docs/architecture.md) — LLM usage is never required.
 */

import type { NormalizedListing } from "@/domain/listing/types";

export interface SellerClassification {
  type: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN";
  confidence: number; // 0..1
  reasons: string[];
}

const PRIVATE_PHRASES = [
  "particulier",
  "zonder makelaar",
  "particulier à particulier",
  "particulier a particulier",
  "geen makelaar",
  "rechtstreeks van eigenaar",
  "van eigenaar",
  "de particulier",
  "no agency",
  "private sale",
  "vente de particulier",
  "immokantoren onthouden zich",
  "geen immokantoren",
];

const PROFESSIONAL_PHRASES = [
  "immokantoor",
  "vastgoedkantoor",
  "makelaarskantoor",
  "agence immobilière",
  "agence immobiliere",
  "real estate agency",
  "erkend vastgoedmakelaar",
  "biv",
  "ipi",
];

const COMPANY_TOKENS = [/\bbv\b/, /\bbvba\b/, /\bnv\b/, /\bsrl\b/, /\bsprl\b/, /\bsa\b/, /\bcommv\b/, /\bimmo\b/, /\bvastgoed\b/, /\brealty\b/, /\bestate\b/, /\bproperties\b/];

export interface SellerClassifierInput {
  description: string | null;
  title: string | null;
  sellerName: string | null;
  sellerKind: string | null;
  agencyName: string | null;
  sellerListingCount: number | null;
}

export function classifierInputFromListing(listing: NormalizedListing): SellerClassifierInput {
  return {
    description: listing.description,
    title: listing.title,
    sellerName: listing.sellerName,
    sellerKind: listing.sellerKind,
    agencyName: listing.agencyName,
    sellerListingCount: listing.sellerListingCount,
  };
}

export function classifySeller(input: SellerClassifierInput): SellerClassification {
  const reasons: string[] = [];
  let privateScore = 0;
  let professionalScore = 0;

  const text = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();
  const sellerKind = input.sellerKind?.toLowerCase() ?? null;
  const sellerName = input.sellerName?.toLowerCase() ?? null;

  // Explicit source metadata is the strongest signal
  if (sellerKind) {
    if (["private", "particulier", "particulier à particulier", "owner", "eigenaar"].includes(sellerKind)) {
      privateScore += 3;
      reasons.push("Source marks seller as private");
    } else if (["agency", "professional", "makelaar", "agence", "pro"].includes(sellerKind)) {
      professionalScore += 3;
      reasons.push("Source marks seller as professional");
    }
  }

  if (input.agencyName) {
    professionalScore += 3;
    reasons.push("Agency identity detected");
  }

  const privatePhrase = PRIVATE_PHRASES.find((p) => text.includes(p));
  if (privatePhrase) {
    privateScore += 2.5;
    reasons.push(`Explicit private seller indication ("${privatePhrase}")`);
  }

  const professionalPhrase = PROFESSIONAL_PHRASES.find((p) => text.includes(p));
  if (professionalPhrase) {
    professionalScore += 2;
    reasons.push(`Professional listing language ("${professionalPhrase}")`);
  }

  if (sellerName) {
    if (COMPANY_TOKENS.some((re) => re.test(sellerName))) {
      professionalScore += 2.5;
      reasons.push("Company identity in seller name");
    } else if (/^[\p{L}'-]+ [\p{L}' -]+$/u.test(input.sellerName!.trim())) {
      privateScore += 1;
      reasons.push("Personal seller identity");
    }
  }

  if (input.sellerListingCount !== null) {
    if (input.sellerListingCount >= 5) {
      professionalScore += 2;
      reasons.push(`Seller has ${input.sellerListingCount} active listings at source`);
    } else if (input.sellerListingCount <= 2) {
      privateScore += 1;
      reasons.push("Seller has few listings at source");
    }
  }

  const diff = privateScore - professionalScore;
  const strength = Math.max(privateScore, professionalScore);

  if (strength === 0) {
    return { type: "UNKNOWN", confidence: 0, reasons: ["No seller signals detected"] };
  }

  // Confidence grows with signal strength and margin between the two sides
  const confidence = Math.min(0.99, 0.5 + 0.08 * strength + 0.06 * Math.abs(diff));

  if (diff > 0.5) {
    if (!reasons.some((r) => r.includes("Agency"))) reasons.push("No agency identity detected");
    return { type: "PRIVATE", confidence: round2(confidence), reasons };
  }
  if (diff < -0.5) {
    return { type: "PROFESSIONAL", confidence: round2(confidence), reasons };
  }
  return { type: "UNKNOWN", confidence: 0.3, reasons: [...reasons, "Conflicting seller signals"] };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
