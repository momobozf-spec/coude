import type { SellerType } from "@/generated/prisma/enums";
import type { NormalizedListing } from "@/domain/listing/normalized-listing";
import type { SellerClassification } from "@/domain/listing/seller-classification";
import { foldText } from "@/normalization/normalizers";

/**
 * Interface for pluggable classifiers. The deterministic rule classifier is
 * the default; an optional AI classifier can be composed later without making
 * LLM usage mandatory.
 */
export interface SellerClassifier {
  readonly name: string;
  classify(listing: NormalizedListing, context?: ClassificationContext): Promise<SellerClassification> | SellerClassification;
}

export interface ClassificationContext {
  /** Number of active listings known for the same seller identity (phone/email). */
  sellerListingCount?: number | null;
  /** Whether the seller name matches a known professional agency identity. */
  knownAgencyIdentity?: boolean;
}

const PRIVATE_PHRASES = [
  "particulier",
  "zonder makelaar",
  "geen makelaar",
  "geen immokantoren",
  "immokantoren onthouden",
  "makelaars onthouden",
  "rechtstreeks van eigenaar",
  "van eigenaar",
  "particulier a particulier",
  "de particulier a particulier",
  "sans agence",
  "pas d'agence",
  "agences s'abstenir",
  "vente directe",
  "by owner",
  "no agents",
  "no agencies",
  "private sale",
  "for sale by owner",
  "fsbo",
];

const PROFESSIONAL_PHRASES = [
  "immo",
  "vastgoed",
  "real estate",
  "makelaar",
  "makelaars",
  "agence immobiliere",
  "immobilier",
  "erkend vastgoedmakelaar",
  "biv",
  "ipi",
  "notaris",
  "notaire",
  "kantoor",
  "ons kantoor",
  "onze kantoren",
  "contacteer ons kantoor",
  "bekijk al onze panden",
  "al onze woningen",
  "projectontwikkelaar",
  "nieuwbouwproject",
];

const COMPANY_SUFFIXES = /\b(bv|bvba|nv|sa|srl|sprl|cv|cvba|vof|comm\.?v|gcv|ltd|gmbh|group|groep)\b/;

function containsAny(text: string, phrases: string[]): string[] {
  return phrases.filter((p) => text.includes(p));
}

export class RuleBasedSellerClassifier implements SellerClassifier {
  readonly name = "rules-v1";

  classify(listing: NormalizedListing, context: ClassificationContext = {}): SellerClassification {
    const text = foldText([listing.title, listing.description].filter(Boolean).join(" ")) ?? "";
    const sellerName = foldText(listing.seller.name) ?? "";
    const company = foldText(listing.seller.company) ?? "";
    const email = listing.seller.email ?? "";
    const reasons: string[] = [];
    let privateScore = 0;
    let proScore = 0;

    // --- Source hints -------------------------------------------------------
    if (listing.seller.typeHint === "PRIVATE") {
      privateScore += 0.5;
      reasons.push("Source marks seller as private");
    } else if (listing.seller.typeHint === "PROFESSIONAL") {
      proScore += 0.5;
      reasons.push("Source marks seller as professional");
    }

    // --- Explicit language ------------------------------------------------
    const privateHits = containsAny(text, PRIVATE_PHRASES);
    if (privateHits.length) {
      privateScore += 0.45;
      reasons.push(`Explicit private seller indication ("${privateHits[0]}")`);
    }
    // Remove private phrases before scanning for professional ones, so that
    // "zonder makelaar" does not count as a professional signal.
    let textForPro = text;
    for (const hit of privateHits) textForPro = textForPro.split(hit).join(" ");
    const proHits = containsAny(textForPro, PROFESSIONAL_PHRASES).filter((p) => p !== "immo" || /\bimmo\b/.test(textForPro));
    if (proHits.length) {
      proScore += 0.3;
      reasons.push(`Professional language detected ("${proHits[0]}")`);
    }

    // --- Identity -----------------------------------------------------------
    if (company || context.knownAgencyIdentity) {
      proScore += 0.45;
      reasons.push(context.knownAgencyIdentity ? "Known agency identity" : "Company identity provided");
    }
    if (sellerName && (COMPANY_SUFFIXES.test(sellerName) || containsAny(sellerName, ["immo", "vastgoed", "real estate", "makelaar", "agence"]).length)) {
      proScore += 0.4;
      reasons.push("Seller name looks like a company / agency brand");
    } else if (sellerName && /^[a-z'-]+( [a-z'-]+){1,3}$/.test(sellerName) && !company) {
      privateScore += 0.2;
      reasons.push("Personal seller name");
    }
    if (email) {
      const domain = email.split("@")[1] ?? "";
      if (/(gmail|hotmail|outlook|telenet|skynet|proximus|live|yahoo|icloud|me)\./.test(domain)) {
        privateScore += 0.1;
        reasons.push("Personal email domain");
      } else if (/(immo|vastgoed|realestate|estate|makelaar)/.test(domain)) {
        proScore += 0.3;
        reasons.push("Professional email domain");
      }
    }

    // --- Volume -------------------------------------------------------------
    const count = context.sellerListingCount ?? listing.seller.listingCount;
    if (count !== null && count !== undefined) {
      if (count >= 5) {
        proScore += 0.35;
        reasons.push(`Seller has ${count} active listings`);
      } else if (count <= 2) {
        privateScore += 0.15;
        reasons.push("Seller has few listings");
      }
    }

    // --- Decide -------------------------------------------------------------
    const total = privateScore + proScore;
    if (total === 0) {
      return { type: "UNKNOWN", confidence: 0.2, reasons: ["No seller signals available"] };
    }
    const type: SellerType = privateScore > proScore ? "PRIVATE" : proScore > privateScore ? "PROFESSIONAL" : "UNKNOWN";
    const margin = Math.abs(privateScore - proScore);
    // Confidence grows with dominance of the winning side and total evidence.
    const dominance = margin / total;
    const evidence = Math.min(1, Math.max(privateScore, proScore));
    const confidence = Number(Math.min(0.99, 0.4 + 0.35 * dominance + 0.25 * evidence).toFixed(2));
    if (type === "UNKNOWN") return { type, confidence: 0.3, reasons: [...reasons, "Conflicting seller signals"] };
    if (type === "PRIVATE" && !reasons.some((r) => /agency|company|professional/i.test(r))) reasons.push("No agency identity detected");
    return { type, confidence, reasons };
  }
}

/** Compose classifiers: later classifiers only override when more confident. */
export function composeClassifiers(...classifiers: SellerClassifier[]): SellerClassifier {
  return {
    name: classifiers.map((c) => c.name).join("+"),
    async classify(listing, context) {
      let best: SellerClassification | null = null;
      for (const c of classifiers) {
        const r = await c.classify(listing, context);
        if (!best || r.confidence > best.confidence) best = r;
      }
      return best ?? { type: "UNKNOWN", confidence: 0, reasons: [] };
    },
  };
}

export const defaultSellerClassifier: SellerClassifier = new RuleBasedSellerClassifier();
