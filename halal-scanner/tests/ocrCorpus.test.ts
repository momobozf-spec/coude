import { describe, expect, it } from "vitest";
import {
  hasIngredientListSignals,
  normalizeOcrText,
} from "@/server/integrations/ocr/normalizeOcrText";
import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";
import { OCR_CORPUS } from "./fixtures/ocrCorpus";

/**
 * Het corpus, laag voor laag.
 *
 * De drie `describe`-blokken zijn met opzet gescheiden en niet één test per
 * etiket. Bij een rode suite wil je in één oogopslag zien of de NORMALISATIE
 * of de PARSER het begeeft — en straks, met een echte provider, of het aan de
 * HERKENNING lag. Eén test die alles tegelijk controleert, geeft dat antwoord
 * niet.
 *
 * Wat hier NIET bewezen wordt: dat een echte OCR-dienst deze teksten oplevert.
 * De `rawTranscription` is met de hand ingevoerd. Deze suite bewijst laag 2 en
 * 3, niet laag 1.
 */

describe("laag 2 - normalisatie", () => {
  for (const entry of OCR_CORPUS) {
    it(`${entry.id} (${entry.language}, ${entry.condition})`, () => {
      expect(normalizeOcrText(entry.rawTranscription).normalized).toBe(entry.expectedNormalized);
    });
  }

  it("bewaart in elk geval de originele tekst", () => {
    for (const entry of OCR_CORPUS) {
      expect(normalizeOcrText(entry.rawTranscription).original).toBe(entry.rawTranscription);
    }
  });
});

describe("laag 3 - parser", () => {
  for (const entry of OCR_CORPUS) {
    it(`${entry.id} levert de verwachte ingrediënten`, () => {
      const parsed = parseIngredientsText(normalizeOcrText(entry.rawTranscription).normalized);
      expect(parsed.map((item) => item.normalizedName)).toEqual(entry.expectedIngredients);
    });
  }
});

describe("de heuristiek over de hele set", () => {
  for (const entry of OCR_CORPUS) {
    it(`${entry.id} geeft ${entry.expectSignals ? "wel" : "geen"} signalen`, () => {
      const normalized = normalizeOcrText(entry.rawTranscription).normalized;
      expect(hasIngredientListSignals(normalized)).toBe(entry.expectSignals);
    });
  }
});

describe("wat de normalisatie met opzet niet doet", () => {
  it("gooit de tweede taal van een tweetalig etiket niet weg", () => {
    // Kiezen welke taal "de echte" is, is raden. De gebruiker ziet beide en
    // kan zelf schrappen wat hij niet nodig heeft.
    const entry = OCR_CORPUS.find((item) => item.id === "nl-fr-tweetalig")!;
    const normalized = normalizeOcrText(entry.rawTranscription).normalized;
    expect(normalized).toContain("suiker");
    expect(normalized).toContain("sucre");
  });

  it("verminkt Arabisch schrift niet", () => {
    const entry = OCR_CORPUS.find((item) => item.id === "ar-alleen")!;
    const normalized = normalizeOcrText(entry.rawTranscription).normalized;
    expect(normalized).toContain("سكر");
  });

  it("laat hoofdletters van allergenen staan", () => {
    const entry = OCR_CORPUS.find((item) => item.id === "nl-hoofdletters-allergenen")!;
    expect(normalizeOcrText(entry.rawTranscription).normalized).toContain("TARWEBLOEM");
  });
});
