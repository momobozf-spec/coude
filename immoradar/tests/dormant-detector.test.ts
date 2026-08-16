import { describe, expect, it } from "vitest";
import { detectDormantLead } from "@/crm/dormant-detector";

const NOW = new Date("2026-08-16T08:00:00Z");

describe("detectDormantLead", () => {
  it("surfaces a dormant valuation lead", () => {
    const result = detectDormantLead({
      contactType: "VALUATION_LEAD",
      status: "UNKNOWN",
      lastContactAt: new Date("2024-11-01"),
      sourceCreatedAt: new Date("2024-10-01"),
      now: NOW,
    });
    expect(result?.category).toBe("DORMANT_VALUATION_LEAD");
    expect(result?.monthsSinceContact).toBe(21);
    expect(result?.uncertainty).toContain("does not prove");
    expect(result?.reasons.join(" ")).toContain("valuation");
  });

  it("ignores recently-contacted valuation leads", () => {
    const result = detectDormantLead({
      contactType: "VALUATION_LEAD",
      status: "ACTIVE",
      lastContactAt: new Date("2026-07-01"),
      sourceCreatedAt: null,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("surfaces a lost seller prospect", () => {
    const result = detectDormantLead({
      contactType: "SELLER",
      status: "LOST",
      lastContactAt: new Date("2025-02-01"),
      sourceCreatedAt: null,
      now: NOW,
    });
    expect(result?.category).toBe("FORMER_SELLER_PROSPECT");
    expect(result?.monthsSinceContact).toBe(18);
  });

  it("surfaces an old buyer as resell candidate", () => {
    const result = detectDormantLead({
      contactType: "BUYER",
      status: "WON",
      lastContactAt: null,
      sourceCreatedAt: new Date("2018-05-01"),
      now: NOW,
    });
    expect(result?.category).toBe("OLD_BUYER");
    expect(result?.reasons).toContain("Bought through agency 2018");
    expect(result?.reasons.join(" ")).toContain("8 years");
  });

  it("does not surface a recent buyer", () => {
    const result = detectDormantLead({
      contactType: "BUYER",
      status: "WON",
      lastContactAt: null,
      sourceCreatedAt: new Date("2024-05-01"),
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("surfaces uncontacted prospects", () => {
    const result = detectDormantLead({
      contactType: "PROSPECT",
      status: "UNKNOWN",
      lastContactAt: null,
      sourceCreatedAt: new Date("2026-01-01"),
      now: NOW,
    });
    expect(result?.category).toBe("UNCONTACTED_LEAD");
  });

  it("surfaces former clients after the threshold", () => {
    const result = detectDormantLead({
      contactType: "FORMER_CLIENT",
      status: "UNKNOWN",
      lastContactAt: new Date("2024-06-01"),
      sourceCreatedAt: null,
      now: NOW,
    });
    expect(result?.category).toBe("FORMER_CLIENT");
  });

  it("returns null for unknown contact types", () => {
    const result = detectDormantLead({
      contactType: "UNKNOWN",
      status: "UNKNOWN",
      lastContactAt: null,
      sourceCreatedAt: new Date("2020-01-01"),
      now: NOW,
    });
    expect(result).toBeNull();
  });
});
