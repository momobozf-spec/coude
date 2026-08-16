import { describe, expect, it } from "vitest";
import { matchProperty, textSimilarity } from "@/matching/property-matcher";
import type { NormalizedListing } from "@/domain/listing/types";
import type { PropertyCandidate } from "@/domain/property/types";

function listing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: "fixture-portal-a",
    sourceListingId: "X",
    sourceUrl: null,
    listingType: "SALE",
    title: null,
    description: null,
    price: 495000,
    currency: "EUR",
    street: "veldstraat",
    houseNumber: "12",
    postalCode: "9000",
    city: "gent",
    province: "oost-vlaanderen",
    address: "veldstraat 12, 9000 gent",
    surfaceArea: 150,
    bedrooms: 3,
    propertyType: "HOUSE",
    sellerName: null,
    sellerPhone: null,
    sellerEmail: null,
    sellerKind: null,
    agencyName: null,
    sellerListingCount: null,
    publishedAt: null,
    status: null,
    original: {},
    ...overrides,
  };
}

function candidate(overrides: Partial<PropertyCandidate> = {}): PropertyCandidate {
  return {
    id: "prop-1",
    street: "veldstraat",
    houseNumber: "12",
    postalCode: "9000",
    city: "gent",
    surfaceArea: 150,
    bedrooms: 3,
    lastKnownPrice: 495000,
    ...overrides,
  };
}

describe("matchProperty", () => {
  it("auto-matches an exact address with corroborating attributes", () => {
    const result = matchProperty(listing(), [candidate()]);
    expect(result.decision).toBe("AUTO_MATCH");
    expect(result.propertyId).toBe("prop-1");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasons).toContain("Exact normalized address match");
  });

  it("never matches across different postal codes", () => {
    const result = matchProperty(listing(), [candidate({ postalCode: "9030" })]);
    expect(result.decision).toBe("NO_MATCH");
    expect(result.confidence).toBe(0);
  });

  it("returns NO_MATCH with no candidates", () => {
    const result = matchProperty(listing(), []);
    expect(result.decision).toBe("NO_MATCH");
    expect(result.propertyId).toBeUndefined();
  });

  it("flags REVIEW for partial evidence instead of auto-merging", () => {
    // No address on the listing — only postal code, surface, bedrooms, price
    const result = matchProperty(
      listing({ street: null, houseNumber: null }),
      [candidate()],
    );
    expect(result.decision).toBe("REVIEW");
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("matches on seller phone even when the address is withheld", () => {
    const result = matchProperty(
      listing({ street: null, houseNumber: null, sellerPhone: "+32472123456" }),
      [candidate({ sellerPhones: ["+32472123456"] })],
    );
    expect(result.reasons).toContain("Seller phone match");
    expect(result.decision).toBe("AUTO_MATCH");
  });

  it("prefers the strongest candidate", () => {
    const weak = candidate({ id: "prop-weak", houseNumber: "14" });
    const strong = candidate({ id: "prop-strong" });
    const result = matchProperty(listing(), [weak, strong]);
    expect(result.propertyId).toBe("prop-strong");
  });

  it("stays conservative when only a street matches", () => {
    const result = matchProperty(
      listing({ houseNumber: null, surfaceArea: null, bedrooms: null, price: null }),
      [candidate({ houseNumber: null, surfaceArea: null, bedrooms: null, lastKnownPrice: null })],
    );
    expect(result.decision).not.toBe("AUTO_MATCH");
  });
});

describe("textSimilarity", () => {
  it("detects near-identical descriptions", () => {
    const a = "Prachtige rijwoning met drie slaapkamers en zonnige tuin in het centrum van Gent";
    const b = "Prachtige rijwoning met drie slaapkamers en zonnige tuin in centrum Gent";
    expect(textSimilarity(a, b)).toBeGreaterThan(0.6);
  });
  it("scores unrelated text low", () => {
    expect(textSimilarity("moderne villa aan zee", "klein appartement stadscentrum")).toBeLessThan(0.2);
  });
  it("handles null", () => {
    expect(textSimilarity(null, "x")).toBe(0);
  });
});
