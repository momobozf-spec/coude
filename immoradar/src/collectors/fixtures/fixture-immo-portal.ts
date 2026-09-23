import type { RawListing } from "@/domain/listing/raw-listing";
import type { CollectContext, CollectorConfig, ListingCollector } from "../types";
import { DEFAULT_COLLECTOR_CONFIG } from "../types";
import { IMMO_PORTAL_TIMELINES, listingAtTick } from "./fixture-data";

/**
 * Fixture collector emulating a property portal API. It never touches the
 * network; the "tick" (from FIXTURE_TICK env or constructor) advances the
 * timelines so repeated pipeline runs produce realistic market events.
 */
export class FixtureImmoPortalCollector implements ListingCollector {
  readonly source = "fixture-immo-portal";
  readonly name = "Fixture: Immo Portal (API emulation)";
  readonly kind = "FIXTURE" as const;
  readonly config: CollectorConfig = { ...DEFAULT_COLLECTOR_CONFIG, pollIntervalMinutes: 30, rateLimitPerMinute: 120, accessNote: "Synthetic fixture data — no external access" };
  private readonly tick: number;

  constructor(tick?: number) {
    this.tick = tick ?? Number(process.env["FIXTURE_TICK"] ?? "0");
  }

  async collect(ctx: CollectContext): Promise<RawListing[]> {
    await ctx.throttle();
    ctx.log("fixture collect", { tick: this.tick });
    return IMMO_PORTAL_TIMELINES.map((t) => listingAtTick(t, this.tick, ctx.now, "https://fixture-immo-portal.example")).filter((l): l is RawListing => l !== null);
  }
}
