import { describe, expect, it } from "vitest";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import type { TerritoryDef } from "@/domain/territory/types";

const territories: TerritoryDef[] = [
  { kind: "POSTAL_CODE", value: "9000" },
  { kind: "POSTAL_CODE", value: "9030" },
  { kind: "MUNICIPALITY", value: "gent" },
  { kind: "PROVINCE", value: "west-vlaanderen" },
];

describe("matchTerritory", () => {
  it("matches postal code with highest precision", () => {
    const result = matchTerritory({ postalCode: "9000", city: "Gent", province: null }, territories);
    expect(result.matched).toBe(true);
    expect(result.level).toBe("POSTAL_CODE");
  });

  it("falls back to municipality", () => {
    const result = matchTerritory({ postalCode: "9050", city: "Gent", province: null }, territories);
    expect(result.level).toBe("MUNICIPALITY");
  });

  it("falls back to province derived from postal code", () => {
    const result = matchTerritory({ postalCode: "8000", city: "Brugge", province: null }, territories);
    expect(result.level).toBe("PROVINCE");
  });

  it("misses outside all territories", () => {
    const result = matchTerritory({ postalCode: "2000", city: "Antwerpen", province: null }, territories);
    expect(result.matched).toBe(false);
    expect(result.level).toBeNull();
  });

  it("normalizes city aliases before matching", () => {
    const result = matchTerritory({ postalCode: null, city: "Ghent", province: null }, territories);
    expect(result.level).toBe("MUNICIPALITY");
  });
});
