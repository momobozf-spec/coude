import { describe, expect, it, vi } from "vitest";
import { backoffDelay, withRetry, TimeoutError } from "./retry";
import { createThrottle } from "./rate-limiter";
import { healthFor } from "./runner";
import { FixtureImmoPortalCollector } from "./fixtures/fixture-immo-portal";
import { FixturePrivateMarketCollector } from "./fixtures/fixture-private-market";
import { getCollector, listCollectorKeys } from "./registry";

const noSleep = async () => undefined;

describe("withRetry", () => {
  it("retries with backoff and succeeds", async () => {
    let calls = 0;
    const onRetry = vi.fn();
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("boom");
      return "ok";
    }, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, timeoutMs: 1000, sleep: noSleep, onRetry });
    expect(r).toEqual({ value: "ok", attempts: 3 });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
  it("gives up after maxRetries", async () => {
    await expect(withRetry(async () => { throw new Error("always"); }, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 1000, sleep: noSleep })).rejects.toThrow("always");
  });
  it("times out slow operations and aborts the signal", async () => {
    let aborted = false;
    await expect(withRetry((signal) => new Promise((resolve) => { signal.addEventListener("abort", () => { aborted = true; }); setTimeout(() => resolve("late"), 200); }), { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1, timeoutMs: 20, sleep: noSleep })).rejects.toBeInstanceOf(TimeoutError);
    expect(aborted).toBe(true);
  });
  it("computes exponential backoff with jitter bounded by max", () => {
    expect(backoffDelay(1, 100, 10000, () => 1)).toBe(100);
    expect(backoffDelay(4, 100, 10000, () => 1)).toBe(800);
    expect(backoffDelay(10, 100, 1000, () => 1)).toBe(1000);
    expect(backoffDelay(3, 100, 10000, () => 0)).toBe(200);
  });
});

describe("createThrottle", () => {
  it("spaces calls according to the per-minute limit", async () => {
    const waits: number[] = [];
    const throttle = createThrottle(120, async (ms) => { waits.push(ms); });
    await throttle();
    await throttle();
    await throttle();
    expect(waits.length).toBeGreaterThanOrEqual(2);
    expect(waits.every((w) => w > 0 && w <= 1000)).toBe(true); // fake sleep: no real time passes, so waits accumulate
  });
  it("is a no-op when unlimited", async () => {
    const throttle = createThrottle(0, async () => { throw new Error("should not sleep"); });
    await expect(throttle()).resolves.toBeUndefined();
  });
});

describe("source health", () => {
  it("derives health from consecutive failures", () => {
    expect(healthFor(0, true)).toBe("HEALTHY");
    expect(healthFor(1, true)).toBe("DEGRADED");
    expect(healthFor(3, true)).toBe("DOWN");
    expect(healthFor(0, false)).toBe("DISABLED");
  });
});

describe("fixture collectors", () => {
  const ctx = { now: new Date("2026-09-23T07:00:00Z"), signal: new AbortController().signal, throttle: async () => undefined, log: () => undefined };
  it("returns listings for tick 0 and evolves over ticks", async () => {
    const t0 = await new FixtureImmoPortalCollector(0).collect(ctx);
    const t3 = await new FixtureImmoPortalCollector(3).collect(ctx);
    expect(t0.find((l) => l.sourceListingId === "IP-3001")?.price).toBe("510000");
    expect(t3.find((l) => l.sourceListingId === "IP-3001")).toBeUndefined(); // removed at tick 3
    const t5 = await new FixtureImmoPortalCollector(5).collect(ctx);
    expect(t5.find((l) => l.sourceListingId === "IP-3001")?.price).toBe("465000"); // relisted
    expect(t0.find((l) => l.sourceListingId === "IP-1001")?.publishedAt).toBe("2026-09-23T07:00:00.000Z");
  });
  it("simulates transient failures then recovers", async () => {
    const c = new FixturePrivateMarketCollector(0, 1);
    await expect(c.collect(ctx)).rejects.toThrow("Simulated transient feed error");
    await expect(c.collect(ctx)).resolves.toHaveLength(3);
  });
  it("is registered", () => {
    expect(listCollectorKeys()).toEqual(["fixture-immo-portal", "fixture-private-market"]);
    expect(getCollector("fixture-immo-portal")?.source).toBe("fixture-immo-portal");
    expect(getCollector("nope")).toBeNull();
  });
});
