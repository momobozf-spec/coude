import { describe, expect, it } from "vitest";
import { exVat, fixedCostsInPeriod, parsePrices, sumPayments, tokenCostEur } from "./costs";
import { can, PERMISSIONS, ROLES } from "./roles";

describe("rollen", () => {
  it("eigenaar mag alles", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
  });
  it("support ziet geen financiën en kan niet terugbetalen of wissen", () => {
    expect(can("support", "users.support")).toBe(true);
    expect(can("support", "finance.view")).toBe(false);
    expect(can("support", "payments.refund")).toBe(false);
    expect(can("support", "users.delete")).toBe(false);
  });
  it("analist ziet geen persoonsgegevens", () => {
    expect(can("analyst", "finance.view")).toBe(true);
    expect(can("analyst", "users.view")).toBe(false);
    expect(can("analyst", "audit.view")).toBe(false);
  });
  it("alleen de eigenaar beheert het team", () => {
    expect(ROLES.filter((r) => can(r, "team.manage"))).toEqual(["owner"]);
  });
  it("geen rol = geen rechten", () => {
    expect(can(null, "dashboard.view")).toBe(false);
  });
});

describe("kosten", () => {
  it("leest tarieven en negeert rommel", () => {
    expect(parsePrices("a-1=3:15, b=1.5:5,kapot,c=x:1")).toEqual({
      "a-1": { inputPerMTok: 3, outputPerMTok: 15 },
      b: { inputPerMTok: 1.5, outputPerMTok: 5 },
    });
  });
  it("rekent tokens om naar euro, of null zonder tarief", () => {
    const prices = parsePrices("m=3:15");
    // 1M in = 3 USD, 0,1M out = 1,5 USD → 4,5 USD × 0,9 = 4,05 EUR
    expect(tokenCostEur("m", 1_000_000, 100_000, prices, 0.9)).toBeCloseTo(4.05, 6);
    expect(tokenCostEur("onbekend", 10, 10, prices, 0.9)).toBeNull();
    expect(tokenCostEur("m", 10, 10, prices, 0)).toBeNull();
  });
  it("haalt btw eruit", () => {
    expect(exVat(1900, 21)).toBeCloseTo(1570.25, 2);
  });
  it("verdeelt vaste kosten per dag", () => {
    const c = [{ monthly_eur: 30, starts_on: "2026-11-01", ends_on: null }];
    // november heeft 30 dagen → 1 euro per dag
    expect(fixedCostsInPeriod(c, new Date("2026-11-01T00:00:00Z"), new Date("2026-11-11T00:00:00Z"))).toBeCloseTo(10, 6);
    // start pas op 6 november
    expect(fixedCostsInPeriod([{ ...c[0], starts_on: "2026-11-06" }], new Date("2026-11-01T00:00:00Z"), new Date("2026-11-11T00:00:00Z"))).toBeCloseTo(5, 6);
    // stopt op 3 november (inclusief)
    expect(fixedCostsInPeriod([{ ...c[0], ends_on: "2026-11-03" }], new Date("2026-11-01T00:00:00Z"), new Date("2026-11-11T00:00:00Z"))).toBeCloseTo(3, 6);
  });
  it("telt betalingen, terugbetalingen en onbekende fees", () => {
    const s = sumPayments([
      { amount_cents: 1900, refunded_cents: 0, fee_cents: 50 },
      { amount_cents: 1499, refunded_cents: 1499, fee_cents: null },
    ], 21);
    expect(s.grossEur).toBeCloseTo(33.99, 2);
    expect(s.refundedEur).toBeCloseTo(14.99, 2);
    expect(s.revenueExVatEur).toBeCloseTo(15.7025, 3);
    expect(s.stripeFeesEur).toBeCloseTo(0.5, 2);
    expect(s.feesUnknown).toBe(1);
  });
});
