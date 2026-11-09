import { describe, expect, it } from "vitest";
import { discountCents, fromCents, shippingCents, toCents } from "@/lib/money";

describe("money", () => {
  it("rekent euro om naar centen zonder afrondingsfout", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(34.95) * 3).toBe(10485);
    expect(fromCents(10485)).toBe(104.85);
  });

  it("weigert ongeldige bedragen", () => {
    expect(() => toCents(Number.NaN)).toThrow();
    expect(() => fromCents(1.5)).toThrow();
  });

  it("verzending: gratis vanaf 75 euro, express altijd betalend", () => {
    expect(shippingCents(7499, "standard")).toBe(595);
    expect(shippingCents(7500, "standard")).toBe(0);
    expect(shippingCents(10000, "express")).toBe(995);
  });

  it("korting: nooit meer dan het subtotaal en nooit negatief", () => {
    expect(discountCents(5000, { discountType: "PERCENTAGE", discountValue: 10 })).toBe(500);
    expect(discountCents(5000, { discountType: "PERCENTAGE", discountValue: 150 })).toBe(5000);
    expect(discountCents(5000, { discountType: "PERCENTAGE", discountValue: -20 })).toBe(0);
    expect(discountCents(300, { discountType: "FIXED", discountValue: 5 })).toBe(300);
    expect(discountCents(1999, { discountType: "PERCENTAGE", discountValue: 15 })).toBe(300);
  });
});
