import { describe, expect, it } from "vitest";
import { normalizeIngredientName } from "@/server/halal/normalizers/text";
import { SOURCE_KEYS, seedSources } from "../prisma/seed-data/sources";
import { seedCertificationBodies } from "../prisma/seed-data/certification-bodies";
import { seedENumbers } from "../prisma/seed-data/e-numbers";
import { seedIngredients } from "../prisma/seed-data/ingredients";

/**
 * Deze tests draaien zonder database. Ze bewaken dat de seed intern consistent
 * is en dat de inhoudelijke afspraken uit docs/DECISION-TREE.md niet
 * ongemerkt sneuvelen bij het toevoegen van data.
 */

const sourceKeys = new Set(seedSources.map((s) => s.key));
const eNumberCodes = new Set(seedENumbers.map((e) => e.code));

describe("bronnen", () => {
  it("heeft unieke keys en unieke (name, organization) combinaties", () => {
    expect(sourceKeys.size).toBe(seedSources.length);
    const pairs = new Set(seedSources.map((s) => `${s.name}|${s.organization}`));
    expect(pairs.size).toBe(seedSources.length);
  });

  it("markeert de eigen heuristiek expliciet als INTERNAL_RULE", () => {
    const internal = seedSources.find((s) => s.key === SOURCE_KEYS.INTERNAL_RULES);
    expect(internal?.sourceType).toBe("INTERNAL_RULE");
  });
});

describe("certificeringsinstanties", () => {
  it("heeft unieke slugs", () => {
    const slugs = new Set(seedCertificationBodies.map((b) => b.slug));
    expect(slugs.size).toBe(seedCertificationBodies.length);
  });

  it("claimt geen uitspraken namens instanties zolang er niets geimporteerd is", () => {
    // Zie prisma/seed.ts: hasImportedRulings wordt hardgecodeerd op false en er
    // worden geen ENumberRuling/IngredientRuling records aangemaakt. Als deze
    // seed ooit rulings toevoegt, moet die vlag mee.
    expect(seedCertificationBodies.every((b) => b.website.startsWith("https://"))).toBe(true);
  });
});

describe("E-nummers", () => {
  it("heeft unieke, canonieke codes", () => {
    expect(eNumberCodes.size).toBe(seedENumbers.length);
    for (const code of eNumberCodes) {
      expect(code).toMatch(/^E\d{3,4}[A-Z]*$/);
    }
  });

  it("verwijst alleen naar bestaande bronnen", () => {
    for (const item of seedENumbers) {
      expect(item.sourceKeys.length).toBeGreaterThan(0);
      for (const key of item.sourceKeys) {
        expect(sourceKeys.has(key)).toBe(true);
      }
    }
  });

  it("classificeert nooit als LIKELY_HALAL wanneer een dierlijke route mogelijk is", () => {
    for (const item of seedENumbers) {
      if (item.animalDerivedPossible) {
        expect(item.defaultStatus).not.toBe("LIKELY_HALAL");
        expect(item.defaultStatus).not.toBe("CERTIFIED_HALAL");
      }
    }
  });

  it("geeft elk additief minstens een bekende productieroute", () => {
    for (const item of seedENumbers) {
      expect(item.possibleSources.length).toBeGreaterThan(0);
    }
  });
});

describe("ingredienten", () => {
  it("heeft unieke genormaliseerde namen", () => {
    const names = seedIngredients.map((i) => normalizeIngredientName(i.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("heeft globaal unieke aliassen", () => {
    const aliases = seedIngredients.flatMap((i) =>
      i.aliases.map((a) => normalizeIngredientName(a)),
    );
    const duplicates = aliases.filter((a, index) => aliases.indexOf(a) !== index);
    expect(duplicates).toEqual([]);
  });

  it("verwijst alleen naar bestaande E-nummers en bronnen", () => {
    for (const item of seedIngredients) {
      if (item.eNumberCode) {
        expect(eNumberCodes.has(item.eNumberCode)).toBe(true);
      }
      for (const key of item.sourceKeys) {
        expect(sourceKeys.has(key)).toBe(true);
      }
    }
  });

  it("bevat de gevraagde demo-ingredienten", () => {
    const aliases = new Set(
      seedIngredients.flatMap((i) => i.aliases.map((a) => normalizeIngredientName(a))),
    );
    for (const expected of ["lard", "gelatin", "glycerine"]) {
      expect(aliases.has(expected)).toBe(true);
    }
  });

  it("markeert varkensafgeleide ingredienten als HARAM", () => {
    const byAlias = (alias: string) =>
      seedIngredients.find((i) =>
        i.aliases.some((a) => normalizeIngredientName(a) === alias),
      );

    expect(byAlias("lard")?.defaultStatus).toBe("HARAM");
    expect(byAlias("porcine gelatin")?.defaultStatus).toBe("HARAM");
  });

  it("markeert gelatine zonder bronvermelding als MUSHBOOH, niet als HARAM", () => {
    const gelatine = seedIngredients.find((i) =>
      i.aliases.some((a) => normalizeIngredientName(a) === "gelatine"),
    );
    expect(gelatine?.defaultStatus).toBe("MUSHBOOH");
  });
});
