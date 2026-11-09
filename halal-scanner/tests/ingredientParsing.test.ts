import { describe, expect, it } from "vitest";
import {
  parseIngredientsText,
  splitTopLevel,
} from "@/server/halal/normalizers/ingredients";

const names = (text: string): string[] =>
  parseIngredientsText(text).map((item) => item.normalizedName);

describe("splitTopLevel", () => {
  it("splitst op komma's", () => {
    expect(splitTopLevel("suiker, melk, E471")).toEqual(["suiker", "melk", "E471"]);
  });

  it("splitst niet binnen haakjes", () => {
    expect(splitTopLevel("chocolade (suiker, cacaomassa), melk")).toEqual([
      "chocolade (suiker, cacaomassa)",
      "melk",
    ]);
  });

  it("splitst ook op puntkomma's", () => {
    expect(splitTopLevel("suiker; melk")).toEqual(["suiker", "melk"]);
  });

  it("negeert lege delen door dubbele scheidingstekens", () => {
    expect(splitTopLevel("suiker,, melk,")).toEqual(["suiker", "melk"]);
  });
});

describe("parseIngredientsText - basis", () => {
  it("splitst de voorbeeldlijst uit de opdracht correct", () => {
    expect(names("suiker, melk, E471")).toEqual(["suiker", "melk", "e471"]);
  });

  it("nummert de posities oplopend vanaf 0", () => {
    const parsed = parseIngredientsText("suiker, melk, E471");
    expect(parsed.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("bewaart de ruwe naam naast de genormaliseerde", () => {
    const parsed = parseIngredientsText("Magere MELKpoeder");
    expect(parsed[0]?.rawName).toBe("Magere MELKpoeder");
    expect(parsed[0]?.normalizedName).toBe("magere melkpoeder");
  });

  it("geeft een lege lijst voor lege of ontbrekende invoer", () => {
    expect(parseIngredientsText(null)).toEqual([]);
    expect(parseIngredientsText(undefined)).toEqual([]);
    expect(parseIngredientsText("   ")).toEqual([]);
  });
});

describe("parseIngredientsText - samengestelde ingredienten", () => {
  it("verwerkt het voorbeeld uit de opdracht", () => {
    const result = names("Suiker, plantaardige olie (palm), emulgator: E471, aroma");
    expect(result).toEqual(["suiker", "plantaardige olie", "palm", "e471", "aroma"]);
  });

  it("haalt sub-ingredienten uit haakjes naar boven", () => {
    // Zonder dit zou de E471 binnen "chocolade" volledig gemist worden.
    const result = names("chocolade (suiker, cacaomassa, emulgator: E471), melk");
    expect(result).toContain("chocolade");
    expect(result).toContain("cacaomassa");
    expect(result).toContain("e471");
  });

  it("verwerkt geneste haakjes", () => {
    const result = names("vulling (chocolade (cacaomassa, E471), suiker)");
    expect(result).toContain("vulling");
    expect(result).toContain("chocolade");
    expect(result).toContain("cacaomassa");
    expect(result).toContain("e471");
  });

  it("strip de functionele klasse vóór de dubbele punt", () => {
    expect(names("emulgator: sojalecithine")).toEqual(["sojalecithine"]);
    expect(names("kleurstof: E120")).toEqual(["e120"]);
    expect(names("zuurteregelaar: citroenzuur")).toEqual(["citroenzuur"]);
  });

  it("behandelt een dubbele punt die géén functionele klasse is als gewone tekst", () => {
    expect(names("merknaam: iets bijzonders")).toEqual(["merknaam iets bijzonders"]);
  });
});

describe("parseIngredientsText - ruis en randgevallen", () => {
  it("verwijdert sporenvermeldingen", () => {
    const result = names("suiker, melk, kan sporen bevatten van noten");
    expect(result).toEqual(["suiker", "melk"]);
  });

  it("haalt percentages uit de naam maar bewaart ze als hoeveelheid", () => {
    const parsed = parseIngredientsText("Cacaomassa 32%, suiker");
    expect(parsed[0]?.normalizedName).toBe("cacaomassa");
    expect(parsed[0]?.quantityText).toBe("32%");
  });

  it("ontdubbelt hetzelfde ingredient en behoudt de eerste positie", () => {
    const parsed = parseIngredientsText("suiker, melk, suiker");
    expect(parsed.map((item) => item.normalizedName)).toEqual(["suiker", "melk"]);
  });

  it("negeert een onafgesloten haakje zonder te crashen", () => {
    const result = names("chocolade (suiker, cacaomassa");
    expect(result).toContain("chocolade");
    expect(result).toContain("suiker");
  });

  it("verwerkt een ingredientenlijst met accenten en hoofdletters", () => {
    expect(names("Mono- en Diglycériden van vetzuren")).toEqual([
      "mono en diglyceriden van vetzuren",
    ]);
  });
});

describe("E-nummerdetectie in geparste ingredienten", () => {
  it("herkent alle schrijfwijzen als hetzelfde nummer", () => {
    for (const variant of ["E471", "E-471", "E 471", "e471"]) {
      const parsed = parseIngredientsText(`suiker, ${variant}`);
      expect(parsed[1]?.eNumberCode).toBe("E471");
    }
  });

  it("laat eNumberCode leeg voor een gewoon ingredient", () => {
    expect(parseIngredientsText("suiker")[0]?.eNumberCode).toBeNull();
  });

  it("herkent een E-nummer met letter-suffix", () => {
    expect(parseIngredientsText("E472e")[0]?.eNumberCode).toBe("E472E");
  });
});
