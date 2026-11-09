import { describe, expect, it } from "vitest";
import { platformFee, feeReference, parseEuroToCents, formatCents } from "@/lib/money";
import { firstAvailableDay } from "@/lib/availability";
import { distanceKm } from "@/lib/geo";
import { suggestCategory } from "@/lib/catalog";

describe("geld", () => {
  it("platformkosten: percentage met minimum", () => {
    expect(platformFee(12_000, 1000, 500)).toBe(1_200);
    expect(platformFee(2_000, 1000, 500)).toBe(500);
    expect(platformFee(0, 1000, 500)).toBe(500);
  });
  it("referentiebedrag per prijssoort", () => {
    expect(feeReference({ priceType: "fixed", amountCents: 5000 })).toBe(5000);
    expect(feeReference({ priceType: "estimate", amountMinCents: 4000 })).toBe(4000);
    expect(feeReference({ priceType: "hourly", hourlyRateCents: 6000, estimatedHoursMin: 2 })).toBe(12000);
    expect(feeReference({ priceType: "inspection", amountCents: 0 })).toBe(0);
  });
  it("euro-invoer", () => {
    expect(parseEuroToCents("120")).toBe(12000);
    expect(parseEuroToCents("119,50")).toBe(11950);
    expect(parseEuroToCents("€ 1.234,56".replace(".", ""))).toBe(123456);
    expect(parseEuroToCents("abc")).toBeNull();
    expect(formatCents(12000, "nl")).toMatch(/120/);
  });
});

describe("beschikbaarheid", () => {
  const slots = [{ weekday: 1, startMin: 8 * 60, endMin: 12 * 60 }];
  it("vindt de eerste maandagvoormiddag binnen de periode", () => {
    // 2026-11-02 is een maandag.
    const r = firstAvailableDay(slots, [], { dateFrom: "2026-11-01", dateTo: "2026-11-08", timePreference: "any" });
    expect(r).toEqual({ date: "2026-11-02", startMin: 480, endMin: 720 });
  });
  it("respecteert tijdvoorkeur en afwezigheden", () => {
    expect(firstAvailableDay(slots, [], { dateFrom: "2026-11-01", dateTo: "2026-11-08", timePreference: "afternoon" })).toBeNull();
    expect(firstAvailableDay(slots, [{ dateFrom: "2026-11-02", dateTo: "2026-11-02" }], { dateFrom: "2026-11-01", dateTo: "2026-11-08", timePreference: "any" })).toBeNull();
    expect(firstAvailableDay(slots, [{ dateFrom: "2026-11-02", dateTo: "2026-11-02" }], { dateFrom: "2026-11-01", dateTo: "2026-11-15", timePreference: "any" })?.date).toBe("2026-11-09");
  });
  it("zonder datum: vanaf morgen, horizon 14 dagen; zonder slots niets", () => {
    const today = new Date("2026-11-01T10:00:00Z");
    expect(firstAvailableDay(slots, [], { timePreference: "any", today })?.date).toBe("2026-11-02");
    expect(firstAvailableDay([], [], { timePreference: "any", today })).toBeNull();
  });
});

describe("geo en categorie", () => {
  it("afstand Berchem–Wuustwezel ≈ 20+ km, Berchem–Mortsel < 5 km", () => {
    expect(distanceKm(51.196, 4.431, 51.392, 4.596)).toBeGreaterThan(20);
    expect(distanceKm(51.196, 4.431, 51.17, 4.456)).toBeLessThan(5);
  });
  it("categoriesuggestie op trefwoorden", () => {
    const cats = [
      { slug: "plumbing", keywords: ["lek", "kraan"] },
      { slug: "electrical", keywords: ["stopcontact", "stroom"] },
    ];
    expect(suggestCategory("De kraan lekt", cats)).toBe("plumbing");
    expect(suggestCategory("Geen stroom in de keuken", cats)).toBe("electrical");
    expect(suggestCategory("Kast monteren", cats)).toBeNull();
  });
});
