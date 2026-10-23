import { describe, expect, it } from "vitest";
import { legalEntity, shopPolicy } from "@/lib/legal";
import { adminProductSchema } from "@/lib/admin";
import { missingSafetyFields, requiresSafetyInfo } from "@/lib/productSafety";

describe("juridische gegevens van de verkoper", () => {
  it("gebruikt standaard Marhaba Data & AI Agent BV, nooit de oude naam", () => {
    const e = legalEntity({} as NodeJS.ProcessEnv);
    expect(e.name).toBe("Marhaba Data & AI Agent BV");
    expect(e.vat).toBe("BE 1003.552.102");
    expect(e.email).toBe("momobozf@gmail.com");
    expect(e.name).not.toMatch(/Cooperation/i);
  });

  it("verzint geen straat: zonder LEGAL_ENTITY_ADDRESS alleen de gemeente en complete=false", () => {
    const e = legalEntity({} as NodeJS.ProcessEnv);
    expect(e.address).toBeNull();
    expect(e.displayAddress).toBe("Zaventem, België");
    expect(e.complete).toBe(false);
    const full = legalEntity({ LEGAL_ENTITY_ADDRESS: "Straat 1, 1930 Zaventem" } as unknown as NodeJS.ProcessEnv);
    expect(full.displayAddress).toBe("Straat 1, 1930 Zaventem");
    expect(full.complete).toBe(true);
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
