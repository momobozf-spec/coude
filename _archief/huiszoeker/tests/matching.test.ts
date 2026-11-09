import { describe, expect, it } from "vitest";
import { matchesCriteria, summarizeReasons, type MatchableProperty } from "../src/services/matchingService.js";
import { searchCriteriaSchema } from "../src/schemas/searchCriteria.js";
import { epcSatisfies, epcRank } from "../src/lib/epc.js";

function criteria(input: unknown) {
  return searchCriteriaSchema.parse(input);
}

const GENT_HOUSE: MatchableProperty = {
  title: "Vrijstaande woning met tuin nabij Gent-centrum",
  description: "Instapklare woning met ruime tuin en carport.",
  city: "Gent",
  postalCode: "9000",
  address: "Voorbeeldstraat 12",
  propertyType: "house",
  transactionType: "buy",
  price: 415_000,
  bedrooms: 4,
  bathrooms: 2,
  livingAreaM2: 165,
  landAreaM2: 420,
  epcLabel: "A",
  features: ["garden", "detached", "solar_panels"],
};

describe("harde eisen", () => {
  it("laat een pand binnen budget door", () => {
    const result = matchesCriteria(
      GENT_HOUSE,
      criteria({ locations: ["Gent"], hardRequirements: { maxPrice: 450_000 } }),
    );
    expect(result.hardPass).toBe(true);
    const price = result.reasons.find((r) => r.field === "maxPrice");
    expect(price?.verdict).toBe("pass");
    expect(price?.detail).toContain("onder je maximumbudget");
  });

  it("wijst een pand boven budget af", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, price: 470_000 },
      criteria({ locations: ["Gent"], hardRequirements: { maxPrice: 450_000 } }),
    );
    expect(result.hardPass).toBe(false);
    expect(result.reasons.find((r) => r.field === "maxPrice")?.detail).toContain("boven je maximumbudget");
  });

  it("wijst een pand met te weinig slaapkamers af", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, bedrooms: 2 },
      criteria({ locations: ["Gent"], hardRequirements: { minBedrooms: 3 } }),
    );
    expect(result.hardPass).toBe(false);
  });

  it("wijst een pand in een andere plaats af wanneer er geen straal is opgegeven", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, city: "Antwerpen", postalCode: "2000" },
      criteria({ locations: ["Gent"], hardRequirements: { maxPrice: 450_000 } }),
    );
    expect(result.hardPass).toBe(false);
  });

  it("wijst een huurpand af bij een koopzoekopdracht", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, transactionType: "rent", price: 1200 },
      criteria({ transactionType: "buy", locations: ["Gent"] }),
    );
    expect(result.hardPass).toBe(false);
  });

  it("sluit uit op excludedKeywords", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, description: "Op te frissen woning, renovatieproject." },
      criteria({ locations: ["Gent"], hardRequirements: { excludedKeywords: ["renovatieproject"] } }),
    );
    expect(result.hardPass).toBe(false);
  });
});

describe("onbekend is niet hetzelfde als onwaar", () => {
  it("laat een ontbrekend EPC een voorkeur niet laten falen", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, epcLabel: null },
      criteria({ locations: ["Gent"], preferences: { epcLabels: ["A", "B"] } }),
    );
    expect(result.hardPass).toBe(true);
    expect(result.reasons.find((r) => r.field === "epcLabels")?.verdict).toBe("unknown");
    // Onbekend telt niet mee in de noemer: geen beoordeelbare voorkeuren over,
    // dus een volle score in plaats van 0.
    expect(result.score).toBe(100);
  });

  it("laat een ontbrekend EPC een harde eis wél laten falen", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, epcLabel: null },
      criteria({ locations: ["Gent"], hardRequirements: { epcLabels: ["A", "B"] } }),
    );
    expect(result.hardPass).toBe(false);
  });

  it("straft een karige advertentie niet af op de score", () => {
    const sparse: MatchableProperty = {
      title: "Woning te koop",
      city: "Gent",
      postalCode: "9000",
      transactionType: "buy",
      price: 400_000,
      features: [],
    };
    const result = matchesCriteria(
      sparse,
      criteria({ locations: ["Gent"], hardRequirements: { maxPrice: 450_000 }, preferences: { minBedrooms: 3 } }),
    );
    expect(result.hardPass).toBe(true);
    expect(result.score).toBe(100);
  });
});

describe("score uit voorkeuren", () => {
  it("geeft 100 wanneer alle voorkeuren gehaald zijn", () => {
    const result = matchesCriteria(
      GENT_HOUSE,
      criteria({ locations: ["Gent"], preferences: { features: ["garden", "detached"] } }),
    );
    expect(result.score).toBe(100);
  });

  it("geeft 50 wanneer de helft gehaald is", () => {
    const result = matchesCriteria(
      GENT_HOUSE,
      criteria({ locations: ["Gent"], preferences: { features: ["garden", "garage"] } }),
    );
    expect(result.score).toBe(50);
    expect(result.hardPass).toBe(true);
  });

  it("meldt een uitstekend pand met één ontbrekende wens nog steeds", () => {
    const result = matchesCriteria(
      GENT_HOUSE,
      criteria({
        locations: ["Gent"],
        hardRequirements: { maxPrice: 450_000, minBedrooms: 3, epcLabels: ["A", "B"] },
        preferences: { features: ["garden", "garage", "solar_panels"] },
      }),
    );
    expect(result.hardPass).toBe(true);
    expect(result.score).toBe(67);

    const { positives, concerns } = summarizeReasons(result.reasons);
    expect(positives.map((r) => r.detail)).toContain("tuin");
    expect(concerns.map((r) => r.detail)).toContain("Geen garage vermeld");
  });

  it("geeft 100 wanneer er geen voorkeuren zijn", () => {
    const result = matchesCriteria(GENT_HOUSE, criteria({ locations: ["Gent"], hardRequirements: { maxPrice: 450_000 } }));
    expect(result.score).toBe(100);
  });
});

describe("EPC-ordening", () => {
  it("accepteert beter dan gevraagd", () => {
    expect(epcSatisfies("A++", ["A", "B"])).toBe(true);
    expect(epcSatisfies("A", ["A", "B"])).toBe(true);
    expect(epcSatisfies("B", ["A", "B"])).toBe(true);
    expect(epcSatisfies("C", ["A", "B"])).toBe(false);
  });

  it("geeft undefined bij een onbekend label", () => {
    expect(epcSatisfies(null, ["A"])).toBeUndefined();
    expect(epcSatisfies("Z", ["A"])).toBeUndefined();
    expect(epcRank("onzin")).toBeUndefined();
  });

  it("laat een A++ door bij een zoekopdracht op A of B", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, epcLabel: "A++" },
      criteria({ locations: ["Gent"], hardRequirements: { epcLabels: ["A", "B"] } }),
    );
    expect(result.hardPass).toBe(true);
  });
});

describe("locatie met straal", () => {
  it("blokkeert een buurgemeente niet, maar doet ook niet alsof de afstand geverifieerd is", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, city: "Sint-Martens-Latem", postalCode: "9830" },
      criteria({ locations: ["Gent"], radiusKm: 15, hardRequirements: { maxPrice: 450_000 } }),
    );
    expect(result.hardPass).toBe(true);
    const location = result.reasons.find((r) => r.field === "locations");
    expect(location?.verdict).toBe("unknown");
    expect(location?.detail).toContain("niet nagerekend");
  });

  it("herkent de plaatsnaam ongeacht diakrieten", () => {
    const result = matchesCriteria(
      { ...GENT_HOUSE, city: "Liège", postalCode: "4000" },
      criteria({ locations: ["Liege"], hardRequirements: { maxPrice: 450_000 } }),
    );
    expect(result.reasons.find((r) => r.field === "locations")?.verdict).toBe("pass");
  });
});

describe("elke uitkomst krijgt een reden", () => {
  it("levert voor elk opgegeven criterium precies één reden op", () => {
    const result = matchesCriteria(
      GENT_HOUSE,
      criteria({
        locations: ["Gent"],
        hardRequirements: { maxPrice: 450_000, minBedrooms: 3, epcLabels: ["A"] },
        preferences: { features: ["garden"] },
      }),
    );
    const fields = result.reasons.map((r) => r.field);
    expect(fields).toContain("transactionType");
    expect(fields).toContain("locations");
    expect(fields).toContain("maxPrice");
    expect(fields).toContain("minBedrooms");
    expect(fields).toContain("epcLabels");
    expect(fields).toContain("features");
    // Geen enkele reden zonder uitleg.
    expect(result.reasons.every((r) => r.detail.length > 0)).toBe(true);
  });
});
