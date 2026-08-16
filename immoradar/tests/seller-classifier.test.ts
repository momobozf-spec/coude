import { describe, expect, it } from "vitest";
import { classifySeller } from "@/classification/seller-classifier";

describe("classifySeller", () => {
  it("classifies explicit private-sale language as PRIVATE", () => {
    const result = classifySeller({
      description: "Verkoop door particulier, zonder makelaar. Rustige buurt.",
      title: "Rijwoning te koop",
      sellerName: "Pieter Janssens",
      sellerKind: null,
      agencyName: null,
      sellerListingCount: 1,
    });
    expect(result.type).toBe("PRIVATE");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.reasons.join(" ")).toContain("private seller");
  });

  it("classifies French private-sale language as PRIVATE", () => {
    const result = classifySeller({
      description: "Vente de particulier à particulier, sans agence.",
      title: null,
      sellerName: "Marie Dupont",
      sellerKind: null,
      agencyName: null,
      sellerListingCount: null,
    });
    expect(result.type).toBe("PRIVATE");
  });

  it("classifies agency identity as PROFESSIONAL", () => {
    const result = classifySeller({
      description: "Contacteer ons immokantoor voor een bezoek.",
      title: "Instapklare woning",
      sellerName: "Immo Deluxe BV",
      sellerKind: null,
      agencyName: "Immo Deluxe",
      sellerListingCount: 45,
    });
    expect(result.type).toBe("PROFESSIONAL");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.reasons).toContain("Agency identity detected");
  });

  it("uses source metadata as strongest signal", () => {
    const result = classifySeller({
      description: null,
      title: null,
      sellerName: null,
      sellerKind: "particulier",
      agencyName: null,
      sellerListingCount: null,
    });
    expect(result.type).toBe("PRIVATE");
  });

  it("uses high listing count as a professional signal", () => {
    const result = classifySeller({
      description: null,
      title: null,
      sellerName: "Vastgoed Partners",
      sellerKind: null,
      agencyName: null,
      sellerListingCount: 30,
    });
    expect(result.type).toBe("PROFESSIONAL");
  });

  it("returns UNKNOWN with no signals", () => {
    const result = classifySeller({
      description: "Mooie woning.",
      title: "Woning",
      sellerName: null,
      sellerKind: null,
      agencyName: null,
      sellerListingCount: null,
    });
    expect(result.type).toBe("UNKNOWN");
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it("returns UNKNOWN on conflicting signals", () => {
    const result = classifySeller({
      description: "Verkoop zonder makelaar via ons immokantoor", // contradictory
      title: null,
      sellerName: null,
      sellerKind: null,
      agencyName: "Immo X",
      sellerListingCount: 1,
    });
    // Professional side should win or conflict — never confidently PRIVATE
    expect(result.type === "PROFESSIONAL" || result.type === "UNKNOWN").toBe(true);
  });
});
