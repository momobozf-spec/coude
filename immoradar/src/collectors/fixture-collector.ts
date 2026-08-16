/**
 * Fixture collectors: realistic mock sources that exercise the full
 * pipeline end-to-end without touching any real website. Each fixture
 * collector serves a scripted "scene" (a point-in-time market state), so
 * successive runs produce price drops, removals and relists.
 */

import type { RawListing } from "@/domain/listing/types";
import type { ListingCollector } from "./types";

export class FixtureCollector implements ListingCollector {
  constructor(
    public readonly source: string,
    private readonly scenes: RawListing[][],
    private sceneIndex = 0,
  ) {}

  collect(): Promise<RawListing[]> {
    const scene = this.scenes[Math.min(this.sceneIndex, this.scenes.length - 1)] ?? [];
    this.sceneIndex++;
    // Deep copy so ingestion can't mutate fixtures
    return Promise.resolve(scene.map((l) => JSON.parse(JSON.stringify(l)) as RawListing));
  }

  /** Jump to a specific scene (used by the demo pipeline and tests) */
  setScene(index: number): void {
    this.sceneIndex = index;
  }
}

/** A collector that always fails — used to test failure isolation. */
export class FailingCollector implements ListingCollector {
  constructor(public readonly source: string, private readonly message = "simulated outage") {}

  collect(): Promise<RawListing[]> {
    return Promise.reject(new Error(this.message));
  }
}
