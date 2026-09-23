import { describe, expect, it } from "vitest";
import { detectPropertyRelist, detectSnapshotEvents, detectStaleEvents, evaluateMissingListing, type ListingState, type SnapshotState } from "./event-engine";
import { DEFAULT_EVENT_CONFIG } from "./config";

const d = (s: string) => new Date(s);
const listing = (over: Partial<ListingState> = {}): ListingState => ({
  id: "L1",
  firstSeenAt: d("2026-01-14T10:00:00Z"),
  lastSeenAt: d("2026-02-01T10:00:00Z"),
  status: "ACTIVE",
  sellerType: "PRIVATE",
  currentPrice: 495000,
  missingCount: 0,
  removedAt: null,
  ...over,
});
const snap = (over: Partial<SnapshotState> = {}): SnapshotState => ({ price: 495000, sellerType: "PRIVATE", status: "ACTIVE", capturedAt: d("2026-02-03T10:00:00Z"), ...over });

describe("detectSnapshotEvents", () => {
  it("emits NEW_LISTING and FSBO_DETECTED for a new private listing", () => {
    const ev = detectSnapshotEvents(listing(), null, snap());
    expect(ev.map((e) => e.type)).toEqual(["NEW_LISTING", "FSBO_DETECTED"]);
  });
  it("emits only NEW_LISTING for a new professional listing", () => {
    const ev = detectSnapshotEvents(listing({ sellerType: "PROFESSIONAL" }), null, snap({ sellerType: "PROFESSIONAL" }));
    expect(ev.map((e) => e.type)).toEqual(["NEW_LISTING"]);
  });
  it("computes price drop difference and percentage", () => {
    const ev = detectSnapshotEvents(listing(), snap({ price: 495000, capturedAt: d("2026-01-14T10:00:00Z") }), snap({ price: 465000 }));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: "PRICE_DROP", oldPrice: 495000, newPrice: 465000, difference: -30000, percentage: -6.06 });
  });
  it("emits PRICE_INCREASE", () => {
    const ev = detectSnapshotEvents(listing(), snap({ price: 400000 }), snap({ price: 420000 }));
    expect(ev[0]?.type).toBe("PRICE_INCREASE");
    expect(ev[0]?.percentage).toBe(5);
  });
  it("ignores tiny price changes below threshold", () => {
    const ev = detectSnapshotEvents(listing(), snap({ price: 500000 }), snap({ price: 499000 }));
    expect(ev).toHaveLength(0);
  });
  it("produces distinct dedupe keys for repeated drops", () => {
    const a = detectSnapshotEvents(listing(), snap({ price: 510000 }), snap({ price: 495000 }))[0]!;
    const b = detectSnapshotEvents(listing(), snap({ price: 495000 }), snap({ price: 475000, capturedAt: d("2026-02-19T10:00:00Z") }))[0]!;
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });
  it("detects agency → private transitions as AGENCY_TO_PRIVATE + FSBO_DETECTED", () => {
    const ev = detectSnapshotEvents(listing({ sellerType: "PROFESSIONAL" }), snap({ sellerType: "PROFESSIONAL" }), snap({ sellerType: "PRIVATE" }));
    expect(ev.map((e) => e.type)).toEqual(["AGENCY_TO_PRIVATE", "FSBO_DETECTED"]);
  });
  it("detects private → agency", () => {
    const ev = detectSnapshotEvents(listing(), snap({ sellerType: "PRIVATE" }), snap({ sellerType: "PROFESSIONAL" }));
    expect(ev.map((e) => e.type)).toEqual(["PRIVATE_TO_AGENCY"]);
  });
  it("emits LISTING_REMOVED when the source reports removal", () => {
    const ev = detectSnapshotEvents(listing(), snap(), snap({ status: "REMOVED" }));
    expect(ev[0]).toMatchObject({ type: "LISTING_REMOVED", payload: { reason: "source_reported" } });
  });
  it("emits RELISTED when a removed listing reappears", () => {
    const ev = detectSnapshotEvents(listing({ status: "REMOVED", removedAt: d("2026-03-07T00:00:00Z") }), snap({ status: "REMOVED", price: 475000 }), snap({ price: 465000, capturedAt: d("2026-03-21T10:00:00Z") }));
    expect(ev.map((e) => e.type)).toEqual(["PRICE_DROP", "RELISTED"]);
  });
});

describe("evaluateMissingListing (removal confirmation)", () => {
  it("does not remove on the first miss", () => {
    const r = evaluateMissingListing(listing(), d("2026-02-03T10:00:00Z"));
    expect(r).toMatchObject({ missingCount: 1, status: "MISSING", event: null });
  });
  it("does not remove when confirmations reached but not enough time elapsed", () => {
    const r = evaluateMissingListing(listing({ missingCount: 1, lastSeenAt: d("2026-02-03T08:00:00Z") }), d("2026-02-03T10:00:00Z"));
    expect(r.status).toBe("MISSING");
    expect(r.event).toBeNull();
  });
  it("confirms removal after N misses and the minimum delay", () => {
    const r = evaluateMissingListing(listing({ missingCount: 1, lastSeenAt: d("2026-02-01T10:00:00Z") }), d("2026-02-03T10:00:00Z"));
    expect(r.status).toBe("REMOVED");
    expect(r.event?.type).toBe("LISTING_REMOVED");
    expect(r.event?.payload).toMatchObject({ reason: "missing_confirmed", missingCount: 2 });
  });
  it("is a no-op for already removed listings", () => {
    const r = evaluateMissingListing(listing({ status: "REMOVED", missingCount: 5 }), d("2026-02-10T10:00:00Z"));
    expect(r.event).toBeNull();
    expect(r.missingCount).toBe(5);
  });
  it("respects custom confirmation config", () => {
    const r = evaluateMissingListing(listing({ missingCount: 0, lastSeenAt: d("2026-01-01T00:00:00Z") }), d("2026-02-03T10:00:00Z"), { ...DEFAULT_EVENT_CONFIG, removalConfirmations: 1 });
    expect(r.status).toBe("REMOVED");
  });
});

describe("detectStaleEvents", () => {
  it("emits every threshold reached with idempotent keys", () => {
    const ev = detectStaleEvents(listing({ firstSeenAt: d("2025-11-01T00:00:00Z") }), d("2026-02-03T00:00:00Z"));
    expect(ev.map((e) => e.type)).toEqual(["STALE_30", "STALE_60", "STALE_90"]);
    expect(ev[0]?.dedupeKey).toBe("L1:STALE_30:once");
    expect(ev[0]?.payload).toMatchObject({ daysObserved: 94 });
  });
  it("emits nothing for fresh or inactive listings", () => {
    expect(detectStaleEvents(listing(), d("2026-02-03T00:00:00Z"))).toHaveLength(0);
    expect(detectStaleEvents(listing({ status: "REMOVED", firstSeenAt: d("2025-01-01T00:00:00Z") }), d("2026-02-03T00:00:00Z"))).toHaveLength(0);
  });
});

describe("detectPropertyRelist", () => {
  it("links a new listing to a recently removed one on the same property", () => {
    const ev = detectPropertyRelist(listing({ id: "L2", currentPrice: 465000 }), [
      { id: "L1", status: "REMOVED", removedAt: d("2026-03-07T00:00:00Z"), lastSeenAt: d("2026-03-05T00:00:00Z"), currentPrice: 475000 },
    ], d("2026-03-21T00:00:00Z"));
    expect(ev).toMatchObject({ type: "RELISTED", oldPrice: 475000, newPrice: 465000, difference: -10000, percentage: -2.11 });
    expect(ev?.payload).toMatchObject({ previousListingId: "L1" });
  });
  it("ignores removals outside the window and the listing itself", () => {
    expect(detectPropertyRelist(listing({ id: "L2" }), [
      { id: "L1", status: "REMOVED", removedAt: d("2025-01-01T00:00:00Z"), lastSeenAt: d("2025-01-01T00:00:00Z"), currentPrice: 1 },
      { id: "L2", status: "REMOVED", removedAt: d("2026-03-01T00:00:00Z"), lastSeenAt: d("2026-03-01T00:00:00Z"), currentPrice: 1 },
    ], d("2026-03-21T00:00:00Z"))).toBeNull();
  });
});
