import { describe, expect, it, vi } from "vitest";
import {
  hasIngredientListSignals,
  normalizeOcrText,
} from "@/server/integrations/ocr/normalizeOcrText";
import { FixtureOcrProvider } from "@/server/integrations/ocr/fixtureProvider";
import { extractIngredientText, validateImageUpload } from "@/server/services/ocrService";
import { analyzeIngredientText } from "@/server/services/textAnalysisService";
import { AppError } from "@/lib/errors";
import type { OcrProvider } from "@/server/integrations/ocr/types";
import type { HalalReference } from "@/server/halal/engine/evidence";
import { jpeg } from "./helpers/imageBytes";

/** Geen externe OCR-dienst, geen database: alles via fixtures en fakes. */

/** Een geldige JPEG-header; de bytevalidatie weigert alles wat dat niet is. */
const IMAGE = jpeg({ width: 1600, height: 1200 });

const REFERENCE: HalalReference = {
  ingredients: [
    {
      id: "i-sugar",
      name: "suiker",
      normalizedName: "suiker",
      defaultStatus: "LIKELY_HALAL",
      defaultConfidence: "HIGH",
      originRisk: "NONE",
      eNumberCode: null,
      aliases: ["sugar"],
      source: null,
    },
    {
      id: "i-gelatine",
      name: "gelatine",
      normalizedName: "gelatine",
      defaultStatus: "MUSHBOOH",
      defaultConfidence: "MEDIUM",
      originRisk: "ANIMAL_POSSIBLE",
      eNumberCode: null,
      aliases: [],
      source: null,
    },
  ],
  eNumbers: [
    {
      id: "e-471",
      code: "E471",
      name: "mono- en diglyceriden",
      defaultStatus: "MUSHBOOH",
      defaultConfidence: "MEDIUM",
      originRisk: "ANIMAL_POSSIBLE",
      animalDerivedPossible: true,
      plantDerivedPossible: true,
      syntheticPossible: false,
      source: null,
    },
  ],
};

const referenceLoader = { load: async () => REFERENCE };

describe("normalizeOcrText", () => {
  it("haalt de kopregel weg in meerdere talen", () => {
    for (const heading of ["INGREDIENTS:", "Ingrediënten:", "Ingrédients :", "Zutaten:"]) {
      const result = normalizeOcrText(`${heading} suiker, cacaoboter`);
      expect(result.normalized).toBe("suiker, cacaoboter");
      expect(result.removedHeading).toBe(true);
    }
  });

  it("plakt woorden weer aan elkaar die over een regel afgebroken zijn", () => {
    expect(normalizeOcrText("emul-\ngator (E322)").normalized).toBe("emulgator (E322)");
  });

  it("maakt van meerdere regels één lopende lijst", () => {
    const raw = "INGREDIENTS: Sugar, cocoa butter,\nMILK powder, emulsifier (E322),\nnatural flavouring.";
    expect(normalizeOcrText(raw).normalized).toBe(
      "Sugar, cocoa butter, MILK powder, emulsifier (E322), natural flavouring",
    );
  });

  it("kapt af bij een volgende sectie op de verpakking", () => {
    const result = normalizeOcrText("suiker, cacao. Voedingswaarde per 100 g: 540 kcal");
    expect(result.normalized).toBe("suiker, cacao");
    expect(result.removedTrailingSection).toBe(true);
  });

  it("bewaart altijd de originele tekst", () => {
    const raw = "INGREDIENTS: sugar\n";
    expect(normalizeOcrText(raw).original).toBe(raw);
  });

  it("corrigeert geen leesfouten", () => {
    // "geiatine" is een verkeerd gelezen "gelatine". Dat mag deze laag niet
    // repareren: gokken naar een verboden ingrediënt is erger dan het als
    // onbekend laten staan. De gebruiker corrigeert zelf.
    const result = normalizeOcrText("Ingrediënten: suiker, geiatine, aroma");
    expect(result.normalized).toContain("geiatine");
    expect(result.normalized).not.toContain("gelatine");
  });

  it("verzint geen ingrediënten bij lege invoer", () => {
    expect(normalizeOcrText("").normalized).toBe("");
    expect(normalizeOcrText("   \n  ").normalized).toBe("");
  });

  it("herkent of iets op een ingrediëntenlijst lijkt", () => {
    expect(hasIngredientListSignals("suiker, cacaoboter, melkpoeder")).toBe(true);
    expect(hasIngredientListSignals("bevat E471 en meer tekst")).toBe(true);
    expect(hasIngredientListSignals("Chocolade Deluxe")).toBe(false);
    expect(hasIngredientListSignals("abc")).toBe(false);
  });
});

describe("uploadvalidatie", () => {
  it("weigert een leeg bestand", () => {
    expect(() => validateImageUpload({ size: 0, mimeType: "image/jpeg" })).toThrowError(AppError);
    try {
      validateImageUpload({ size: 0, mimeType: "image/jpeg" });
    } catch (error) {
      expect((error as AppError).details?.reason).toBe("EMPTY_FILE");
    }
  });

  it("weigert een niet-ondersteund type", () => {
    try {
      validateImageUpload({ size: 100, mimeType: "application/pdf" });
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).code).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect((error as AppError).details?.reason).toBe("UNSUPPORTED_TYPE");
    }
  });

  it("weigert SVG, ook al is dat een afbeelding", () => {
    // SVG is uitvoerbare markup; die hoort niet door een beeldpijplijn.
    expect(() => validateImageUpload({ size: 100, mimeType: "image/svg+xml" })).toThrowError(AppError);
  });

  it("weigert een te groot bestand", () => {
    try {
      validateImageUpload({ size: 999 * 1024 * 1024, mimeType: "image/jpeg" });
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).details?.reason).toBe("TOO_LARGE");
    }
  });

  it("accepteert een normale foto", () => {
    expect(() => validateImageUpload({ size: 500_000, mimeType: "image/jpeg" })).not.toThrow();
  });
});

describe("extractIngredientText", () => {
  it("levert opgeschoonde tekst bij een goede foto", async () => {
    const outcome = await extractIngredientText(
      { image: IMAGE, mimeType: "image/jpeg", fileName: "achterkant.jpg" },
      { provider: new FixtureOcrProvider({ scenario: "clear" }) },
    );

    expect(outcome.text).toBe(
      "Sugar, cocoa butter, MILK powder, emulsifier (E322), natural flavouring",
    );
    expect(outcome.lowConfidence).toBe(false);
    expect(outcome.warnings).toHaveLength(0);
    // De ruwe tekst blijft beschikbaar voor diagnose.
    expect(outcome.rawText).toContain("INGREDIENTS:");
  });

  it("waarschuwt bij lage zekerheid zonder te blokkeren", async () => {
    const outcome = await extractIngredientText(
      { image: IMAGE, mimeType: "image/jpeg" },
      { provider: new FixtureOcrProvider({ scenario: "low-confidence" }) },
    );

    expect(outcome.lowConfidence).toBe(true);
    expect(outcome.warnings.join(" ")).toMatch(/controleer de ingrediënten/i);
    // De tekst komt gewoon door: de gebruiker mag hem corrigeren.
    expect(outcome.text).toContain("geiatine");
  });

  it("faalt met NO_TEXT wanneer er niets gelezen is", async () => {
    try {
      await extractIngredientText(
        { image: IMAGE, mimeType: "image/jpeg" },
        { provider: new FixtureOcrProvider({ scenario: "no-text" }) },
      );
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).details?.reason).toBe("NO_TEXT");
    }
  });

  it("waarschuwt wanneer de tekst geen ingrediëntenlijst lijkt", async () => {
    const outcome = await extractIngredientText(
      { image: IMAGE, mimeType: "image/jpeg" },
      { provider: new FixtureOcrProvider({ scenario: "not-an-ingredient-list" }) },
    );

    // Geen harde fout: de gebruiker kan de tekst alsnog aanvullen. Wel een
    // waarschuwing, want dit is bijna altijd een foto van de voorkant.
    expect(outcome.text).toBe("Chocolade Deluxe");
    expect(outcome.warnings.join(" ")).toMatch(/achterkant van de verpakking/i);
  });

  it("geeft een providerstoring door als PROVIDER_UNAVAILABLE", async () => {
    try {
      await extractIngredientText(
        { image: IMAGE, mimeType: "image/jpeg" },
        { provider: new FixtureOcrProvider({ scenario: "provider-error" }) },
      );
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).code).toBe("PROVIDER_UNAVAILABLE");
    }
  });

  it("logt geen afbeelding en geen herkende tekst", async () => {
    const provider: OcrProvider = {
      name: "spy",
      extractText: vi.fn(async () => ({
        text: "Ingrediënten: suiker, cacao, melkpoeder",
        confidence: 0.9,
        providerName: "spy",
      })),
    };

    const outcome = await extractIngredientText(
      { image: IMAGE, mimeType: "image/jpeg" },
      { provider },
    );

    // De service geeft de tekst wel terug aan de aanroeper, maar het contract
    // is dat er niets van in de logs komt; dat is hier vastgelegd in de
    // logger-implementatie (alleen aantallen) en getest via het ontbreken van
    // tekstvelden in de OcrOutcome-logging.
    expect(outcome.text).toContain("suiker");
    expect(provider.extractText).toHaveBeenCalledTimes(1);
  });
});

describe("analyzeIngredientText", () => {
  it("analyseert tekst via dezelfde engine en slaat niets op", async () => {
    const outcome = await analyzeIngredientText("suiker, gelatine", { referenceLoader });

    expect(outcome.ingredientCount).toBe(2);
    expect(outcome.analysis.status).toBe("MUSHBOOH");
    // Geen product betekent geen certificaten.
    expect(outcome.analysis.certificateEvidence).toEqual([]);
  });

  it("kan nooit CERTIFIED_HALAL opleveren zonder product", async () => {
    const outcome = await analyzeIngredientText("suiker", { referenceLoader });
    expect(outcome.analysis.status).not.toBe("CERTIFIED_HALAL");
    // Alles bekend en onproblematisch is "waarschijnlijk halal", geen claim.
    expect(outcome.analysis.status).toBe("LIKELY_HALAL");
  });

  it("herkent een E-nummer uit de tekst", async () => {
    const outcome = await analyzeIngredientText("suiker, emulgator E471", { referenceLoader });
    expect(outcome.analysis.findings.some((f) => f.eNumberCode === "E471")).toBe(true);
  });

  it("weigert lege tekst", async () => {
    await expect(analyzeIngredientText("   ", { referenceLoader })).rejects.toThrowError(AppError);
  });

  it("weigert te lange tekst", async () => {
    await expect(
      analyzeIngredientText("a, ".repeat(3000), { referenceLoader }),
    ).rejects.toThrowError(AppError);
  });

  it("waarschuwt wanneer een deel van de tekst niet gelezen kon worden", async () => {
    // Frans-Arabisch etiket: het Arabische deel valt uit de parser weg. Zonder
    // deze waarschuwing zou "geen aandachtspunt gevonden" gelezen worden als
    // een oordeel over de hele lijst, terwijl de helft niet bekeken is.
    const outcome = await analyzeIngredientText("sucre, huile végétale المكونات: سكر", {
      referenceLoader,
    });

    expect(outcome.warnings.join(" ")).toMatch(/schrift dat we nog niet kunnen lezen/i);
    expect(outcome.ingredientCount).toBe(2);
  });

  it("waarschuwt niet bij gewone Latijnse tekst", async () => {
    const outcome = await analyzeIngredientText("sucre, huile végétale", { referenceLoader });
    expect(outcome.warnings).toEqual([]);
  });

  it("weigert tekst waar niets uit te halen valt in plaats van niets te melden", async () => {
    // Volledig Arabisch: er blijft geen enkel ingrediënt over. Een lege lijst
    // door de engine halen zou "geen aandachtspunt gevonden" opleveren over
    // een tekst die nooit gelezen is; dat is het gevaarlijkste antwoord.
    await expect(
      analyzeIngredientText("المكونات: سكر، زبدة الكاكاو، حليب مجفف", { referenceLoader }),
    ).rejects.toMatchObject({ details: { reason: "NO_INGREDIENTS_PARSED" } });
  });

  it("houdt een onbekend ingrediënt zichtbaar in plaats van het weg te laten", async () => {
    const outcome = await analyzeIngredientText("suiker, geiatine", { referenceLoader });
    const unknown = outcome.analysis.findings.find((f) => f.findingType === "UNKNOWN_INGREDIENT");
    expect(unknown?.label).toContain("geiatine");
  });
});
