import { describe, expect, it } from "vitest";
import {
  extractENumbers,
  normalizeENumberCode,
  normalizeIngredientName,
  normalizeText,
} from "@/server/halal/normalizers/text";

describe("normalizeText", () => {
  it("verwijdert accenten en leestekens", () => {
    expect(normalizeText("Mono- en Diglycéridèn")).toBe("mono en diglyceriden");
  });

  it("vouwt herhaalde whitespace samen", () => {
    expect(normalizeText("  suiker   \n melk ")).toBe("suiker melk");
  });

  it("behoudt de inhoud van haakjes", () => {
    expect(normalizeText("gelatine (rund)")).toBe("gelatine rund");
  });
});

describe("normalizeIngredientName", () => {
  it("strip percentages die niets over de herkomst zeggen", () => {
    expect(normalizeIngredientName("Cacaomassa 32%")).toBe("cacaomassa");
  });
});

describe("normalizeENumberCode", () => {
  it("normaliseert alle gangbare schrijfwijzen naar dezelfde code", () => {
    for (const input of ["E471", "E-471", "e 471", "e.471", "E471"]) {
      expect(normalizeENumberCode(input)).toBe("E471");
    }
  });

  it("behoudt de letter-suffix, want E472e is een ander additief", () => {
    expect(normalizeENumberCode("E 472e")).toBe("E472E");
  });

  it("geeft null voor tekst zonder E-nummer", () => {
    expect(normalizeENumberCode("suiker")).toBeNull();
  });
});

describe("extractENumbers", () => {
  it("haalt alle E-nummers uit een ingredientenlijst, ontdubbeld", () => {
    const text = "suiker, emulgator (E471, e-471), kleurstof E 120";
    expect(extractENumbers(text)).toEqual(["E471", "E120"]);
  });
});
