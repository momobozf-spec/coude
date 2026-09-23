import type { RawListing } from "@/domain/listing/raw-listing";
import type { CollectContext, CollectorConfig, ListingCollector } from "../types";
import { DEFAULT_COLLECTOR_CONFIG } from "../types";
import { PRIVATE_MARKET_TIMELINES, listingAtTick } from "./fixture-data";

/** Fixture collector emulating a structured-data feed of private listings. */
export class FixturePrivateMarketCollector implements ListingCollector {
  readonly source = "fixture-private-market";
  readonly name = "Fixture: Private Market (feed emulation)";
  readonly kind = "FIXTURE" as const;
  readonly config: CollectorConfig = { ...DEFAULT_COLLECTOR_CONFIG, pollIntervalMinutes: 60, rateLimitPerMinute: 60, accessNote: "Synthetic fixture data — no external access" };
  private readonly tick: number;
  private readonly failuresToSimulate: number;

  constructor(tick?: number, failuresToSimulate = 0) {
    this.tick = tick ?? Number(process.env["FIXTURE_TICK"] ?? "0");
    this.failuresToSimulate = failuresToSimulate;
  }

  private failed = 0;

  async collect(ctx: CollectContext): Promise<RawListing[]> {
    await ctx.throttle();
    if (this.failed < this.failuresToSimulate) {
      this.failed++;
      throw new Error("Simulated transient feed error");
    }
    return PRIVATE_MARKET_TIMELINES.map((t) => listingAtTick(t, this.tick, ctx.now, "https://fixture-private-market.example")).filter((l): l is RawListing => l !== null);
  }
}
