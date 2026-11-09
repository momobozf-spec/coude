import { describe, expect, it } from "vitest";
import { legalEntity, shopPolicy } from "@/lib/legal";
import { adminProductSchema } from "@/lib/admin";
import { missingSafetyFields, requiresSafetyInfo } from "@/lib/productSafety";

describe("juridische gegevens van de verkoper", () => {
  it("gebruikt standaard Marhaba Cooperation BV, nooit de oude naam", () => {
    const e = legalEntity({} as NodeJS.ProcessEnv);
    expect(e.name).toBe("Marhaba Cooperation BV");
    expect(e.vat).toBe("BE 1037.222.285");
    expect(e.email).toBe("momobozf@gmail.com");
    expect(e.name).not.toMatch(/Data & AI Agent/i);
  });

  it("zonder LEGAL_ENTITY_ADDRESS de zetel uit het KBO-register; alleen een gemeente is niet volledig", () => {
    const e = legalEntity({} as NodeJS.ProcessEnv);
    expect(e.address).toBe("Sweetstraat 13, 3870 Heers");
    expect(e.displayAddress).toBe("Sweetstraat 13, 3870 Heers");
    expect(e.complete).toBe(true);
    const other = legalEntity({ LEGAL_ENTITY_ADDRESS: "Andere Straat 2, 3870 Heers" } as unknown as NodeJS.ProcessEnv);
    expect(other.displayAddress).toBe("Andere Straat 2, 3870 Heers");
    expect(other.complete).toBe(true);
    const cityOnly = legalEntity({ LEGAL_ENTITY_ADDRESS: "Heers" } as unknown as NodeJS.ProcessEnv);
    expect(cityOnly.complete).toBe(false);
  });

  it("retourkosten: standaard voor de klant, instelbaar naar de verkoper", () => {
    expect(shopPolicy({} as NodeJS.ProcessEnv).returnCostsPaidBy).toBe("customer");
    expect(shopPolicy({ RETURN_COSTS_PAID_BY: "seller" } as unknown as NodeJS.ProcessEnv).returnCostsPaidBy).toBe("seller");
    expect(shopPolicy({} as NodeJS.ProcessEnv).withdrawalDays).toBe(14);
  });
});

describe("productveiligheid (GPSR/CLP)", () => {
  const complete = {
    status: "ACTIVE",
    safetyInfo: "Laat een brandende kaars nooit onbewaakt achter.",
    safetyInfoFr: "Ne laissez jamais une bougie allumée sans surveillance.",
    manufacturerInfo: "Fabrikant BV, Straat 1, 1000 Brussel, info@fabrikant.be",
  };

  it("geldt voor kaarsen, geur en producten met geuren", () => {
    expect(requiresSafetyInfo("candles-lanterns")).toBe(true);
    expect(requiresSafetyInfo("fragrance")).toBe(true);
    expect(requiresSafetyInfo("tea-experience")).toBe(false);
    expect(requiresSafetyInfo("gifts", ["Oud"])).toBe(true);
  });

  it("weigert een actieve kaars zonder veiligheidsinfo of fabrikant", () => {
    expect(missingSafetyFields("candles-lanterns", { status: "ACTIVE" })).toHaveLength(3);
    expect(missingSafetyFields("candles-lanterns", { ...complete, safetyInfoFr: " " })).toHaveLength(1);
    expect(missingSafetyFields("candles-lanterns", complete)).toEqual([]);
  });

  it("laat een concept of een theeglas zonder veiligheidsinfo toe", () => {
    expect(missingSafetyFields("candles-lanterns", { status: "DRAFT" })).toEqual([]);
    expect(missingSafetyFields("tea-experience", { status: "ACTIVE" })).toEqual([]);
  });

  it("aanvaardt alleen geldige CLP-pictogramcodes", () => {
    const base = { name: "Kaars", description: "d", price: "12", stock: "1", categoryId: "c1" };
    expect(adminProductSchema.safeParse({ ...base, hazardPictograms: ["GHS07", "GHS09"] }).success).toBe(true);
    expect(adminProductSchema.safeParse({ ...base, hazardPictograms: ["GHS99"] }).success).toBe(false);
  });
});
