import { describe, expect, it } from "vitest";
import { FailingCollector, FixtureCollector } from "@/collectors/fixture-collector";
import { runCollector, runCollectors } from "@/collectors/runner";
import type { ListingCollector } from "@/collectors/types";
import type { RawListing } from "@/domain/listing/types";

const noSleep = () => Promise.resolve();

const sampleListing: RawListing = {
  source: "fixture-portal-a",
  sourceListingId: "A-1",
  title: "Test",
};

describe("runCollector", () => {
  it("collects from a fixture collector", async () => {
    const collector = new FixtureCollector("fixture-portal-a", [[sampleListing]]);
    const result = await runCollector(collector, { sleepFn: noSleep });
    expect(result.ok).toBe(true);
    expect(result.listings).toHaveLength(1);
    expect(result.attempts).toBe(1);
  });

  it("retries with backoff and reports failure after max retries", async () => {
    const sleeps: number[] = [];
    const collector = new FailingCollector("fixture-broken");
    const result = await runCollector(collector, {
      policy: { maxRetries: 3, backoffBaseMs: 100 },
      sleepFn: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.error).toContain("simulated outage");
    expect(sleeps).toEqual([100, 200]); // exponential backoff
  });

  it("recovers when a retry succeeds", async () => {
    let calls = 0;
    const flaky: ListingCollector = {
      source: "fixture-flaky",
      collect: () => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("transient"));
        return Promise.resolve([sampleListing]);
      },
    };
    const result = await runCollector(flaky, { sleepFn: noSleep });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("times out hung collectors", async () => {
    const hung: ListingCollector = {
      source: "fixture-hung",
      collect: () => new Promise(() => undefined),
    };
    const result = await runCollector(hung, {
      policy: { timeoutMs: 50, maxRetries: 1 },
      sleepFn: noSleep,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timed out");
  });
});

describe("runCollectors (failure isolation)", () => {
  it("one failing collector never affects the others", async () => {
    const good = new FixtureCollector("fixture-good", [[sampleListing]]);
    const bad = new FailingCollector("fixture-bad");
    const good2 = new FixtureCollector("fixture-good-2", [[sampleListing, sampleListing]]);

    const results = await runCollectors([good, bad, good2], {
      policy: { maxRetries: 2, backoffBaseMs: 1 },
      sleepFn: noSleep,
    });
    expect(results).toHaveLength(3);
    expect(results[0]!.ok).toBe(true);
    expect(results[1]!.ok).toBe(false);
    expect(results[2]!.ok).toBe(true);
    expect(results[2]!.listings).toHaveLength(2);
  });
});

describe("FixtureCollector scenes", () => {
  it("advances through scenes to simulate market evolution", async () => {
    const scene1 = [{ ...sampleListing, price: 500000 }];
    const scene2 = [{ ...sampleListing, price: 480000 }];
    const collector = new FixtureCollector("fixture-portal-a", [scene1, scene2]);
    const first = await collector.collect();
    const second = await collector.collect();
    const third = await collector.collect(); // stays on last scene
    expect(first[0]!.price).toBe(500000);
    expect(second[0]!.price).toBe(480000);
    expect(third[0]!.price).toBe(480000);
  });
});
