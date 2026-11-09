import { describe, expect, it } from "vitest";
import { normalizePlace, parsePlaces, scoreListing, sourceOf, type Listing, type SearchProfile } from "./matching";

const profile: SearchProfile = { maxMonthly: 1100, municipalities: parsePlaces("Antwerpen, Berchem; 2600"), minBedrooms: 2, pets: true };
const base: Listing = {
  title: "Appartement 2 slpk", url: "https://www.immoweb.be/nl/zoekertje/appartement/te-huur/berchem/2600/123",
  municipality: "Berchem", postcode: "2600", rent_eur: 950, charges_eur: 75, bedrooms: 2, pets_allowed: true,
};

describe("sourceOf", () => {
  it("herkent toegelaten bronnen en weigert de rest", () => {
    expect(sourceOf(base.url)).toBe("immoweb");
    expect(sourceOf("https://m.zimmo.be/x")).toBe("zimmo");
    expect(sourceOf("https://immoweb.be.evil.com/x")).toBeNull();
    expect(sourceOf("javascript:alert(1)")).toBeNull();
    expect(sourceOf("not a url")).toBeNull();
  });
});

describe("places", () => {
  it("normaliseert accenten en scheidingstekens", () => {
    expect(normalizePlace("Sint-Gillis / Saint-Gilles")).toBe("sint gillis saint gilles");
    expect(parsePlaces("Liège, liege ; Gent")).toEqual(["liege", "gent"]);
  });
});

describe("scoreListing", () => {
  it("perfecte match = 100", () => {
    const r = scoreListing(base, profile);
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual(["budget_ok", "area_ok", "bedrooms_ok"]);
  });
  it("krap budget telt minder", () => {
    expect(scoreListing({ ...base, rent_eur: 1030, charges_eur: 60 }, profile).reasons).toContain("budget_tight");
  });
  it("te duur of verkeerde gemeente valt onder de drempel", () => {
    expect(scoreListing({ ...base, rent_eur: 1200 }, profile).score).toBeLessThanOrEqual(45);
    expect(scoreListing({ ...base, municipality: "Gent", postcode: "9000" }, profile).score).toBeLessThanOrEqual(45);
  });
  it("onbekende velden tellen half", () => {
    const r = scoreListing({ ...base, rent_eur: null, bedrooms: null, pets_allowed: null }, profile);
    expect(r.score).toBe(25 + 25 + 7 + 5);
  });
  it("geen huisdieren toegelaten wordt gemeld", () => {
    expect(scoreListing({ ...base, pets_allowed: false }, profile).reasons).toContain("pets_no");
  });
});
