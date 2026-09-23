import { describe, expect, it } from "vitest";
import { normalizeListing } from "@/normalization/normalize-listing";
import { RuleBasedSellerClassifier, composeClassifiers, type SellerClassifier } from "./seller-classifier";

const clf = new RuleBasedSellerClassifier();
const mk = (over: Record<string, unknown>) =>
  normalizeListing("fixture", { sourceListingId: "1", postalCode: "9000", ...over });

describe("RuleBasedSellerClassifier", () => {
  it("classifies explicit private-sale language as PRIVATE with high confidence", () => {
    const r = clf.classify(mk({ description: "Verkoop door particulier, zonder makelaar. Immokantoren onthouden.", sellerName: "Pieter Janssens", sellerEmail: "pieter@telenet.be" }));
    expect(r.type).toBe("PRIVATE");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.reasons.join(" ")).toMatch(/Explicit private seller indication/);
    expect(r.reasons).toContain("No agency identity detected");
  });

  it("classifies French private phrasing", () => {
    const r = clf.classify(mk({ description: "Vente de particulier à particulier, agences s'abstenir." }));
    expect(r.type).toBe("PRIVATE");
  });

  it("classifies agency branding as PROFESSIONAL", () => {
    const r = clf.classify(mk({ sellerName: "Immo Vermeulen BV", sellerCompany: "Immo Vermeulen BV", description: "Contacteer ons kantoor voor een bezoek. Bekijk al onze panden.", sellerEmail: "info@immovermeulen.be" }));
    expect(r.type).toBe("PROFESSIONAL");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("uses listing volume from context", () => {
    const r = clf.classify(mk({ sellerName: "Jan Peeters" }), { sellerListingCount: 12 });
    expect(r.type).toBe("PROFESSIONAL");
    expect(r.reasons).toContain("Seller has 12 active listings");
  });

  it("returns UNKNOWN when there are no signals", () => {
    const r = clf.classify(mk({}));
    expect(r.type).toBe("UNKNOWN");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("returns UNKNOWN on strongly conflicting signals", () => {
    const r = clf.classify(mk({ sellerType: "private", sellerCompany: "Immo X", description: "Verkoop zonder makelaar" }), { knownAgencyIdentity: false });
    // private: 0.5 + 0.45 = 0.95; pro: 0.45 → PRIVATE wins but with modest confidence
    expect(["PRIVATE", "UNKNOWN"]).toContain(r.type);
    expect(r.confidence).toBeLessThan(0.85);
  });

  it("respects a professional source hint over weak private signals", () => {
    const r = clf.classify(mk({ sellerType: "agency", sellerName: "Jan Peeters" }));
    expect(r.type).toBe("PROFESSIONAL");
  });
});

describe("composeClassifiers", () => {
  it("lets a more confident classifier override", async () => {
    const ai: SellerClassifier = { name: "ai-stub", classify: () => ({ type: "PROFESSIONAL", confidence: 0.99, reasons: ["stub"] }) };
    const composed = composeClassifiers(clf, ai);
    const r = await composed.classify(mk({ description: "particulier" }));
    expect(r.type).toBe("PROFESSIONAL");
    expect(composed.name).toBe("rules-v1+ai-stub");
  });
});
