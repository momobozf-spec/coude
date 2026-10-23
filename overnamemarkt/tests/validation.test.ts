import { describe, expect, it } from "vitest";
import { formatMultiple, multiple, safeNext } from "@/lib/format";
import { interestSchema, listingSchema, parseAmount } from "@/lib/validation";

const validListing = {
  title: "Planningstool voor schoonmaakbedrijven",
  type: "SaaS",
  country: "BE",
  founded_year: "2021",
  asking_price: "180.000",
  revenue_12m: "72000",
  profit_12m: "41.000",
  customers: "140",
  tech_stack: "Laravel",
  sale_reason: "Nieuw project",
  description: "Roosters en uren voor kleine schoonmaakbedrijven in Vlaanderen.",
  contact_email: "verkoper@example.com",
  consent_accuracy: "on",
  consent_publish: "on",
};

describe("parseAmount", () => {
  it("leest Belgische notaties", () => {
    expect(parseAmount("180.000")).toBe(180000);
    expect(parseAmount("1.250.000")).toBe(1250000);
    expect(parseAmount("€ 45 000")).toBe(45000);
    expect(parseAmount("180000,50")).toBe(180000.5);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("")).toBeUndefined();
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
  });
});

describe("listingSchema", () => {
  it("aanvaardt een volledige aanbieding", () => {
    const r = listingSchema.safeParse(validListing);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.asking_price).toBe(180000);
      expect(r.data.profit_12m).toBe(41000);
      expect(r.data.founded_year).toBe(2021);
    }
  });
  it("laat negatieve winst toe maar geen negatieve omzet", () => {
    expect(listingSchema.safeParse({ ...validListing, profit_12m: "-5000" }).success).toBe(true);
    expect(listingSchema.safeParse({ ...validListing, revenue_12m: "-1" }).success).toBe(false);
  });
  it("weigert zonder toestemmingen", () => {
    expect(listingSchema.safeParse({ ...validListing, consent_publish: undefined }).success).toBe(false);
  });
  it("weigert onbekende velden zoals status", () => {
    expect(listingSchema.safeParse({ ...validListing, status: "published" }).success).toBe(false);
  });
  it("weigert ongeldig type, land en e-mail", () => {
    expect(listingSchema.safeParse({ ...validListing, type: "Crypto" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, country: "FR" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, contact_email: "geen-mail" }).success).toBe(false);
  });
});

describe("interestSchema", () => {
  const ok = {
    listing_id: "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90",
    message: "Ik ben ondernemer en wil de churn zien.",
    contact_email: "koper@example.com",
    budget: "",
    consent_confidential: "on",
    consent_share: "on",
  };
  it("aanvaardt een geldige interesse zonder budget", () => {
    expect(interestSchema.safeParse(ok).success).toBe(true);
  });
  it("weigert een onbekend budget en een ongeldige id", () => {
    expect(interestSchema.safeParse({ ...ok, budget: "1 miljoen" }).success).toBe(false);
    expect(interestSchema.safeParse({ ...ok, listing_id: "abc" }).success).toBe(false);
  });
});

describe("format", () => {
  it("berekent de multiple alleen bij positieve winst", () => {
    expect(multiple(180000, 40000)).toBe(4.5);
    expect(multiple(180000, 0)).toBeNull();
    expect(formatMultiple(100000, -1)).toBe("—");
  });
  it("laat alleen interne redirects toe", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
  });
});
