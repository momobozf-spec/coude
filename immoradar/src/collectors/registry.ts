import type { ListingCollector } from "./types";
import { FixtureImmoPortalCollector } from "./fixtures/fixture-immo-portal";
import { FixturePrivateMarketCollector } from "./fixtures/fixture-private-market";

const registry = new Map<string, () => ListingCollector>();

export function registerCollector(key: string, factory: () => ListingCollector): void {
  registry.set(key, factory);
}

export function getCollector(key: string): ListingCollector | null {
  const f = registry.get(key);
  return f ? f() : null;
}

export function listCollectorKeys(): string[] {
  return [...registry.keys()];
}

/** Built-in collectors. Real-source collectors are registered here once their permitted access method is established. */
registerCollector("fixture-immo-portal", () => new FixtureImmoPortalCollector());
registerCollector("fixture-private-market", () => new FixturePrivateMarketCollector());
