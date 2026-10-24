/**
 * Het register van supermarktadapters.
 *
 * Een nieuwe keten toevoegen:
 *   1. maak `<keten>.adapter.ts` met `createChainAdapter({...})`;
 *   2. voeg hem hieronder toe aan `SUPERMARKET_ADAPTERS`;
 *   3. draai `npm run compare:sync` (of de seed) — de keten verschijnt vanzelf.
 *
 * Niets anders in de codebase kent de lijst met ketens.
 */
import { albertHeijnAdapter } from './albert-heijn.adapter';
import { aldiAdapter } from './aldi.adapter';
import { carrefourAdapter } from './carrefour.adapter';
import { colruytAdapter } from './colruyt.adapter';
import { delhaizeAdapter } from './delhaize.adapter';
import { jumboAdapter } from './jumbo.adapter';
import { lidlAdapter } from './lidl.adapter';
import { sparAdapter } from './spar.adapter';
import type { SupermarketAdapter } from './supermarket-adapter';

/** Nest injection token, zodat services het register kunnen vervangen in tests. */
export const SUPERMARKET_ADAPTERS = Symbol('SUPERMARKET_ADAPTERS');

export const supermarketAdapters: readonly SupermarketAdapter[] = Object.freeze([
  delhaizeAdapter,
  lidlAdapter,
  colruytAdapter,
  sparAdapter,
  albertHeijnAdapter,
  jumboAdapter,
  carrefourAdapter,
  aldiAdapter,
]);

export function getAdapter(key: string, registry: readonly SupermarketAdapter[] = supermarketAdapters): SupermarketAdapter | undefined {
  return registry.find((adapter) => adapter.key === key);
}

/** Dubbele sleutels zijn een programmeerfout; vang ze bij het opstarten. */
export function assertUniqueAdapterKeys(registry: readonly SupermarketAdapter[]): void {
  const seen = new Set<string>();
  for (const adapter of registry) {
    if (seen.has(adapter.key)) throw new Error(`Adaptersleutel "${adapter.key}" komt twee keer voor`);
    if (!/^[a-z0-9-]{1,40}$/.test(adapter.key)) throw new Error(`Adaptersleutel "${adapter.key}" is geen geldige slug`);
    seen.add(adapter.key);
  }
}
