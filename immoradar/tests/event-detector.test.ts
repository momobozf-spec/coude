import { describe, expect, it } from "vitest";
import {
  clearRemovalState,
  DEFAULT_EVENT_CONFIG,
  detectFsbo,
  detectPriceChange,
  detectRelist,
  detectSellerTypeChange,
  detectStale,
  processMissingListing,
} from "@/events/event-detector";

const T0 = new Date("2026-08-01T08:00:00Z");

describe("detectPriceChange", () => {
  it("emits PRICE_DROP with payload", () => {
    const event = detectPriceChange(495000, 465000, T0);
    expect(event?.type).toBe("PRICE_DROP");
    expect(event?.payload).toEqual({
      oldPrice: 495000,
      newPrice: 465000,
      difference: -30000,
      percentage: -6.06,
    });
  });
  it("emits PRICE_INCREASE", () => {
    const event = detectPriceChange(400000, 420000, T0);
    expect(event?.type).toBe("PRICE_INCREASE");
    expect((event?.payload as { percentage: number }).percentage).toBe(5);
  });
  it("ignores noise below the threshold", () => {
    expect(detectPriceChange(500000, 499999, T0)).toBeNull();
    expect(detectPriceChange(500000, 500000, T0)).toBeNull();
    expect(detectPriceChange(null, 500000, T0)).toBeNull();
  });
});

describe("detectSellerTypeChange", () => {
  it("detects AGENCY_TO_PRIVATE and PRIVATE_TO_AGENCY", () => {
    expect(detectSellerTypeChange("PROFESSIONAL", "PRIVATE", T0)?.type).toBe("AGENCY_TO_PRIVATE");
    expect(detectSellerTypeChange("PRIVATE", "PROFESSIONAL", T0)?.type).toBe("PRIVATE_TO_AGENCY");
    expect(detectSellerTypeChange("UNKNOWN", "PRIVATE", T0)).toBeNull();
    expect(detectSellerTypeChange("PRIVATE", "PRIVATE", T0)).toBeNull();
  });
});

describe("detectStale", () => {
  const firstSeen = new Date("2026-05-01T00:00:00Z");
  it("emits each threshold exactly once", () => {
    const now = new Date("2026-07-05T00:00:00Z"); // 65 days later
    const events = detectStale(firstSeen, now, new Set());
    expect(events.map((e) => e.type)).toEqual(["STALE_30", "STALE_60"]);

    const again = detectStale(firstSeen, now, new Set(["STALE_30", "STALE_60"]));
    expect(again).toEqual([]);
  });
  it("emits nothing before 30 days", () => {
    const now = new Date("2026-05-20T00:00:00Z");
    expect(detectStale(firstSeen, now, new Set())).toEqual([]);
  });
});

describe("processMissingListing (removal confirmation)", () => {
  it("never confirms removal from a failed collector run", () => {
    const { state, event } = processMissingListing(
      { missingSince: null, missingRunCount: 0 },
      T0,
      false,
    );
    expect(event).toBeNull();
    expect(state.missingRunCount).toBe(0);
  });

  it("requires both run count and elapsed hours before confirming", () => {
    let state = { missingSince: null as Date | null, missingRunCount: 0 };
    // First successful run with the listing missing
    let result = processMissingListing(state, T0, true);
    expect(result.event).toBeNull();
    state = result.state;

    // Second run only 2 hours later: run count met, hours not met
    result = processMissingListing(state, new Date(T0.getTime() + 2 * 3600_000), true);
    expect(result.event).toBeNull();
    state = result.state;

    // Third run 25 hours after first missing: both thresholds met
    result = processMissingListing(state, new Date(T0.getTime() + 25 * 3600_000), true);
    expect(result.event?.type).toBe("LISTING_REMOVED");
  });

  it("clearRemovalState resets pending state when the listing reappears", () => {
    expect(clearRemovalState()).toEqual({ missingSince: null, missingRunCount: 0 });
  });
});

describe("detectRelist", () => {
  it("detects a relist within the window", () => {
    const removedAt = new Date("2026-03-07T00:00:00Z");
    const seenAt = new Date("2026-03-21T00:00:00Z");
    const event = detectRelist(removedAt, seenAt);
    expect(event?.type).toBe("RELISTED");
    expect((event?.payload as { daysOffMarket: number }).daysOffMarket).toBe(14);
  });
  it("ignores removals outside the window", () => {
    const removedAt = new Date("2025-01-01T00:00:00Z");
    const seenAt = new Date("2026-03-21T00:00:00Z");
    expect(detectRelist(removedAt, seenAt)).toBeNull();
    expect(detectRelist(null, seenAt)).toBeNull();
  });
  it("respects a custom window", () => {
    const removedAt = new Date("2026-01-01T00:00:00Z");
    const seenAt = new Date("2026-01-20T00:00:00Z");
    expect(detectRelist(removedAt, seenAt, { ...DEFAULT_EVENT_CONFIG, relistWindowDays: 10 })).toBeNull();
  });
});

describe("detectFsbo", () => {
  it("fires once for confident private sale listings", () => {
    expect(detectFsbo("PRIVATE", 0.9, "SALE", false, T0)?.type).toBe("FSBO_DETECTED");
    expect(detectFsbo("PRIVATE", 0.9, "SALE", true, T0)).toBeNull();
    expect(detectFsbo("PRIVATE", 0.4, "SALE", false, T0)).toBeNull();
    expect(detectFsbo("PROFESSIONAL", 0.9, "SALE", false, T0)).toBeNull();
    expect(detectFsbo("PRIVATE", 0.9, "RENT", false, T0)).toBeNull();
  });
});
