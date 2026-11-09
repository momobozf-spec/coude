import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "../src/ai/searchParser.js";
import { normalizeRawCriteria, parseAmount } from "../src/ai/normalizeCriteria.js";
import { searchCriteriaSchema, type SearchCriteria } from "../src/schemas/searchCriteria.js";
import { AiDisabledError, AiParseError, ValidationError } from "../src/lib/errors.js";
import { FailingAiProvider, StubAiProvider } from "./helpers/stubAiProvider.js";
import { getAiProvider } from "../src/ai/providers/index.js";

/**
 * De zoekopdrachten hieronder zijn representatief voor wat gebruikers intypen.
 * Bij elke opdracht staat de ruwe modeloutput zoals een model die realistisch
 * teruggeeft — inclusief de slordigheden die we willen kunnen opvangen — en wat
 * eruit moet komen na normalisatie en validatie.
 */
interface Case {
  name: string;
  query: string;
  rawModelOutput: unknown;
  expect: (criteria: SearchCriteria) => void;
}

const CASES: Case[] = [
  {
    name: "NL — volledige opdracht met harde eisen en voorkeuren",
    query:
      "Ik zoek een vrijstaande woning in Gent of maximaal 15 km rond Gent, onder €450.000, minstens 3 slaapkamers, EPC A of B, liefst een tuin en garage.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Gent"],
      radiusKm: 15,
      hardRequirements: {
        propertyTypes: ["house"],
        maxPrice: "450.000",
        minBedrooms: 3,
        epcLabels: ["A", "B"],
        features: ["detached"],
      },
      preferences: { features: ["garden", "garage"] },
    },
    expect: (c) => {
      expect(c.transactionType).toBe("buy");
      expect(c.locations).toEqual(["Gent"]);
      expect(c.radiusKm).toBe(15);
      expect(c.hardRequirements.maxPrice).toBe(450_000);
      expect(c.hardRequirements.minBedrooms).toBe(3);
      expect(c.hardRequirements.epcLabels).toEqual(["A", "B"]);
      expect(c.preferences.features).toEqual(["garden", "garage"]);
    },
  },
  {
    name: "NL — onvolledige opdracht blijft geldig",
    query: "Appartement rond Brussel onder 300k.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Brussel"],
      hardRequirements: { propertyTypes: ["apartment"], maxPrice: "300k" },
      preferences: {},
    },
    expect: (c) => {
      expect(c.hardRequirements.maxPrice).toBe(300_000);
      // Niet genoemd blijft onbekend — er wordt niets ingevuld.
      expect(c.hardRequirements.minBedrooms).toBeUndefined();
      expect(c.hardRequirements.epcLabels).toBeUndefined();
      expect(c.radiusKm).toBeUndefined();
    },
  },
  {
    name: "NL — huur met maandbedrag",
    query: "Appartement te huur in Leuven, maximaal 1200 euro per maand, minstens 2 slaapkamers.",
    rawModelOutput: {
      transactionType: "rent",
      locations: ["Leuven"],
      hardRequirements: { propertyTypes: ["apartment"], maxPrice: "1200 euro", minBedrooms: 2 },
      preferences: {},
    },
    expect: (c) => {
      expect(c.transactionType).toBe("rent");
      expect(c.hardRequirements.maxPrice).toBe(1200);
      expect(c.hardRequirements.minBedrooms).toBe(2);
    },
  },
  {
    name: "FR — 'au moins' is hard, 'de préférence' is voorkeur",
    query:
      "Maison à vendre à Liège, maximum 350.000 €, au moins 4 chambres, de préférence avec jardin et garage.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Liège"],
      hardRequirements: { propertyTypes: ["house"], maxPrice: "350.000 €", minBedrooms: 4 },
      preferences: { features: ["garden", "garage"] },
    },
    expect: (c) => {
      expect(c.hardRequirements.maxPrice).toBe(350_000);
      expect(c.hardRequirements.minBedrooms).toBe(4);
      expect(c.preferences.features).toEqual(["garden", "garage"]);
    },
  },
  {
    name: "EN — 'at least' is hard, 'ideally' is voorkeur",
    query:
      "Looking for a house for sale near Bruges, budget 500k, at least 3 bedrooms, ideally with a garage.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Bruges"],
      hardRequirements: { propertyTypes: ["house"], maxPrice: "500k", minBedrooms: 3 },
      preferences: { features: ["garage"] },
    },
    expect: (c) => {
      expect(c.hardRequirements.maxPrice).toBe(500_000);
      expect(c.preferences.features).toEqual(["garage"]);
    },
  },
  {
    name: "NL — miljoenbedrag met decimale komma",
    query: "Villa in Knokke tot 1,2 miljoen euro met zwembad.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Knokke"],
      hardRequirements: { propertyTypes: ["villa"], maxPrice: "1,2 miljoen" },
      preferences: { features: ["swimming_pool"] },
    },
    expect: (c) => {
      expect(c.hardRequirements.maxPrice).toBe(1_200_000);
    },
  },
  {
    name: "NL — 'moet echt' maakt een feature hard",
    query: "Huis in Antwerpen, moet echt een tuin hebben, liefst ook een garage.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Antwerpen"],
      hardRequirements: { propertyTypes: ["house"], features: ["garden"] },
      preferences: { features: ["garage"] },
    },
    expect: (c) => {
      expect(c.hardRequirements.features).toEqual(["garden"]);
      expect(c.preferences.features).toEqual(["garage"]);
    },
  },
  {
    name: "NL — uitsluitingen belanden in excludedKeywords",
    query: "Woning in Mechelen onder 400.000, geen renovatieproject.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Mechelen"],
      hardRequirements: { propertyTypes: ["house"], maxPrice: 400000, excludedKeywords: ["renovatieproject"] },
      preferences: {},
    },
    expect: (c) => {
      expect(c.hardRequirements.excludedKeywords).toEqual(["renovatieproject"]);
    },
  },
  {
    name: "NL — postcodes als getal worden strings",
    query: "Huis in 9000 en 9050, budget 500.000 euro.",
    rawModelOutput: {
      transactionType: "buy",
      postalCodes: [9000, 9050],
      hardRequirements: { propertyTypes: ["house"], maxPrice: "€500.000" },
      preferences: {},
    },
    expect: (c) => {
      expect(c.postalCodes).toEqual(["9000", "9050"]);
      expect(c.hardRequirements.maxPrice).toBe(500_000);
    },
  },
  {
    name: "NL — grondoppervlakte en bewoonbare oppervlakte",
    query: "Huis in Hasselt met minstens 150 m² bewoonbaar en 500 m² grond, maximaal 600k.",
    rawModelOutput: {
      transactionType: "buy",
      locations: ["Hasselt"],
      hardRequirements: {
        propertyTypes: ["house"],
        maxPrice: "600k",
        minSurfaceM2: 150,
        minLandSurfaceM2: 500,
      },
      preferences: {},
    },
    expect: (c) => {
      expect(c.hardRequirements.minSurfaceM2).toBe(150);
      expect(c.hardRequirements.minLandSurfaceM2).toBe(500);
      expect(c.hardRequirements.maxPrice).toBe(600_000);
    },
  },
  {
    name: "EN — hoofdletters en dubbele features worden opgeschoond",
    query: "Apartment in Ghent with a TERRACE and terrace, elevator, under 350000.",
    rawModelOutput: {
      transactionType: "BUY",
      locations: ["Ghent"],
      hardRequirements: { propertyTypes: ["APARTMENT"], maxPrice: 350000 },
      preferences: { features: ["TERRACE", "terrace", "Elevator"] },
    },
    expect: (c) => {
      expect(c.transactionType).toBe("buy");
      expect(c.hardRequirements.propertyTypes).toEqual(["apartment"]);
      expect(c.preferences.features).toEqual(["terrace", "elevator"]);
    },
  },
  {
    name: "NL — geen transactietype genoemd betekent koop",
    query: "Woning in Oostende met zeezicht, 3 slaapkamers.",
    rawModelOutput: {
      locations: ["Oostende"],
      hardRequirements: { propertyTypes: ["house"], minBedrooms: 3 },
      preferences: { keywords: ["zeezicht"] },
    },
    expect: (c) => {
      expect(c.transactionType).toBe("buy");
      expect(c.preferences.keywords).toEqual(["zeezicht"]);
    },
  },
];

describe("parseSearchQuery — representatieve zoekopdrachten", () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const provider = new StubAiProvider(testCase.rawModelOutput);
      const result = await parseSearchQuery(testCase.query, { provider });
      testCase.expect(result.criteria);
      expect(result.criteriaVersion).toBe(1);
    });
  }
});

describe("parseSearchQuery — bewaking van de modeloutput", () => {
  it("weigert verzonnen velden in plaats van ze door te laten", async () => {
    const provider = new StubAiProvider({
      transactionType: "buy",
      locations: ["Gent"],
      hardRequirements: { maxPrice: 400000 },
      preferences: {},
      // Dit veld bestaat niet in het schema.
      mustHaveSauna: true,
    });
    await expect(parseSearchQuery("Huis in Gent onder 400k", { provider })).rejects.toBeInstanceOf(AiParseError);
  });

  it("negeert een waarde die niet in de toegestane lijst staat", async () => {
    const provider = new StubAiProvider({
      transactionType: "buy",
      locations: ["Gent"],
      hardRequirements: { propertyTypes: ["house"], maxPrice: 400000 },
      // "sauna" is geen bekende feature en verdwijnt bij normalisatie.
      preferences: { features: ["garden", "sauna"] },
    });
    const result = await parseSearchQuery("Huis in Gent met tuin en sauna", { provider });
    expect(result.criteria.preferences.features).toEqual(["garden"]);
  });

  it("zet een veld dat in beide groepen staat alleen bij de harde eisen", async () => {
    const provider = new StubAiProvider({
      transactionType: "buy",
      locations: ["Gent"],
      hardRequirements: { maxPrice: 450000 },
      preferences: { maxPrice: 500000 },
    });
    const result = await parseSearchQuery("Huis in Gent onder 450k", { provider });
    expect(result.criteria.hardRequirements.maxPrice).toBe(450_000);
    expect(result.criteria.preferences.maxPrice).toBeUndefined();
  });

  it("weigert output waaruit geen enkel criterium volgt", async () => {
    const provider = new StubAiProvider({ transactionType: "buy", hardRequirements: {}, preferences: {} });
    await expect(parseSearchQuery("Ik zoek iets leuks", { provider })).rejects.toBeInstanceOf(AiParseError);
  });

  it("probeert het opnieuw met de validatiefouten erbij en slaagt daarna", async () => {
    const provider = new StubAiProvider(
      // Eerste poging: minPrice hoger dan maxPrice.
      {
        transactionType: "buy",
        locations: ["Gent"],
        hardRequirements: { minPrice: 600000, maxPrice: 450000 },
        preferences: {},
      },
      // Tweede poging: gecorrigeerd.
      {
        transactionType: "buy",
        locations: ["Gent"],
        hardRequirements: { minPrice: 300000, maxPrice: 450000 },
        preferences: {},
      },
    );
    const result = await parseSearchQuery("Huis in Gent tussen 300k en 450k", { provider });
    expect(result.criteria.hardRequirements.minPrice).toBe(300_000);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.user).toContain("voldeed niet aan het schema");
  });

  it("geeft de provider-fout door wanneer de provider zelf onbereikbaar is", async () => {
    const provider = new FailingAiProvider(new Error("netwerk weg"));
    await expect(parseSearchQuery("Huis in Gent", { provider })).rejects.toThrow("netwerk weg");
  });

  it("weigert een lege zoekopdracht zonder het model aan te roepen", async () => {
    const provider = new StubAiProvider({});
    await expect(parseSearchQuery("   ", { provider })).rejects.toBeInstanceOf(ValidationError);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("AI_ENABLED=false", () => {
  it("gooit AiDisabledError in plaats van een halve poging te doen", async () => {
    // De testomgeving draait met AI_ENABLED=false (zie vitest.config.ts), dus
    // de fabriek levert de uitgeschakelde provider.
    await expect(parseSearchQuery("Huis in Gent onder 400k", { provider: getAiProvider() })).rejects.toBeInstanceOf(
      AiDisabledError,
    );
  });
});

describe("parseAmount", () => {
  const cases: [unknown, number | undefined][] = [
    ["450k", 450_000],
    ["450K", 450_000],
    ["450.000", 450_000],
    ["450 000", 450_000],
    ["€450000", 450_000],
    ["450.000 euro", 450_000],
    ["EUR 450k", 450_000],
    ["1,2 miljoen", 1_200_000],
    ["1.2 million", 1_200_000],
    ["1200", 1200],
    [450_000, 450_000],
    ["", undefined],
    ["geen idee", undefined],
    [null, undefined],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${String(expected)}`, () => {
      expect(parseAmount(input)).toBe(expected);
    });
  }
});

describe("normalizeRawCriteria", () => {
  it("laat een straal zonder plaats weg in plaats van de hele opdracht te laten falen", () => {
    const normalized = normalizeRawCriteria({ transactionType: "buy", radiusKm: 20, hardRequirements: { maxPrice: 300000 } });
    expect(normalized.radiusKm).toBeUndefined();
    expect(searchCriteriaSchema.safeParse(normalized).success).toBe(true);
  });

  it("geeft een bruikbaar object terug bij volledig onbruikbare invoer", () => {
    const normalized = normalizeRawCriteria("dit is geen object");
    expect(searchCriteriaSchema.safeParse(normalized).success).toBe(true);
  });
});
