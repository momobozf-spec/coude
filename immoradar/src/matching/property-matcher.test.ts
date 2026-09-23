import { describe, expect, it } from "vitest";
import { decisionFor, matchProperty, scoreCandidate, type MatchSubject, type PropertyCandidate } from "./property-matcher";
import { jaccard, stringSimilarity } from "./text-similarity";

const base: MatchSubject = {
  addressKey: "kortrijksesteenweg|123|9000",
  street: "kortrijksesteenweg",
  houseNumber: "123",
  postalCode: "9000",
  city: "Gent",
  surfaceArea: 145,
  bedrooms: 3,
  price: 495000,
  description: "Ruime rijwoning met zuidgerichte tuin en garage, instapklaar, nabij het centrum van Gent.",
  sellerPhone: "+32478123456",
};

const cand = (over: Partial<PropertyCandidate>): PropertyCandidate => ({ ...base, propertyId: "p1", ...over });

describe("scoreCandidate", () => {
  it("scores exact address plus attributes as an auto match", () => {
    const s = scoreCandidate(base, cand({}));
    expect(s.confidence).toBeGreaterThanOrEqual(0.85);
    expect(s.reasons).toContain("Exact normalized address match");
    expect(decisionFor(s.confidence)).toBe("AUTO_MATCH");
  });

  it("does not auto-match on the same street with a different house number", () => {
    const s = scoreCandidate(base, cand({ addressKey: "kortrijksesteenweg|125|9000", houseNumber: "125", sellerPhone: null, description: "Iets anders" }));
    expect(s.reasons).toContain("House number conflict");
    expect(decisionFor(s.confidence)).toBe("NO_MATCH");
  });

  it("auto-matches when street, phone and all attributes agree even without a house number", () => {
    const subject: MatchSubject = { ...base, addressKey: null, houseNumber: null };
    const s = scoreCandidate(subject, cand({}));
    expect(decisionFor(s.confidence)).toBe("AUTO_MATCH");
    expect(s.reasons).toContain("Same seller phone number");
    expect(s.reasons).toContain("Same street and postal code");
  });

  it("flags for review when address is incomplete and only attributes agree", () => {
    const subject: MatchSubject = { ...base, addressKey: null, houseNumber: null, sellerPhone: null, description: "Andere tekst" };
    const s = scoreCandidate(subject, cand({}));
    expect(s.confidence).toBeGreaterThanOrEqual(0.55);
    expect(s.confidence).toBeLessThan(0.85);
    expect(decisionFor(s.confidence)).toBe("REVIEW");
  });

  it("gives near-zero for unrelated properties", () => {
    const s = scoreCandidate(base, cand({
      addressKey: "veldstraat|1|2000", street: "veldstraat", houseNumber: "1", postalCode: "2000", city: "Antwerpen",
      surfaceArea: 80, bedrooms: 1, price: 210000, description: "Studio in het centrum", sellerPhone: "+32499000000",
    }));
    expect(s.confidence).toBeLessThan(0.1);
    expect(decisionFor(s.confidence)).toBe("NO_MATCH");
  });

  it("uses coordinates when present", () => {
    const subject: MatchSubject = { ...base, addressKey: null, street: null, houseNumber: null, latitude: 51.0543, longitude: 3.7174 };
    const s = scoreCandidate(subject, cand({ latitude: 51.0544, longitude: 3.7175, sellerPhone: null }));
    expect(s.reasons).toContain("Coordinates within 30m");
  });
});

describe("matchProperty", () => {
  it("returns NO_MATCH with no candidates", () => {
    expect(matchProperty(base, []).decision).toBe("NO_MATCH");
  });
  it("selects the best candidate and never returns a propertyId for NO_MATCH", () => {
    const r = matchProperty(base, [
      cand({ propertyId: "far", addressKey: "x|1|2000", street: "x", houseNumber: "1", postalCode: "2000", city: "Antwerpen", sellerPhone: null, description: null, surfaceArea: null, bedrooms: null, price: null }),
      cand({ propertyId: "near" }),
    ]);
    expect(r.propertyId).toBe("near");
    expect(r.decision).toBe("AUTO_MATCH");
    const none = matchProperty({ ...base, addressKey: "a|1|1000", street: "a", houseNumber: "1", postalCode: "1000", city: "Brussel", sellerPhone: null, description: null, surfaceArea: null, bedrooms: null, price: null }, [cand({})]);
    expect(none.decision).toBe("NO_MATCH");
    expect(none.propertyId).toBeUndefined();
  });
  it("respects custom thresholds", () => {
    const subject: MatchSubject = { ...base, addressKey: null, houseNumber: null, sellerPhone: null, description: null };
    const strict = matchProperty(subject, [cand({})], { autoMatch: 0.99, review: 0.9 });
    expect(strict.decision).toBe("NO_MATCH");
  });
});

describe("text similarity", () => {
  it("computes jaccard on folded tokens", () => {
    expect(jaccard("Ruime woning met tuin", "ruime WONING met TUIN!")).toBe(1);
    expect(jaccard("a b c", null)).toBe(0);
  });
  it("computes levenshtein similarity", () => {
    expect(stringSimilarity("janssens", "janssens")).toBe(1);
    expect(stringSimilarity("janssens", "jansens")).toBeGreaterThan(0.8);
    expect(stringSimilarity("abc", "xyz")).toBe(0);
  });
});
