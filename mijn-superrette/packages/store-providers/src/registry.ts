import type { BaseStoreProvider } from './base.js';
import { DevelopmentSeedProvider } from './development/development-seed-provider.js';
import { OpenPricesProvider } from './providers/open-prices.js';
import { PartnerFeedProvider, type PartnerFeedConfig } from './providers/partner-feed.js';
import {
  AlbertHeijnProvider,
  CarrefourProvider,
  ColruytProvider,
  DelhaizeProvider,
  JumboProvider,
  otherRetailerProviders,
} from './providers/retailers.js';
import type { StoreProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, StoreProvider>();

  register(provider: StoreProvider): this {
    if (this.providers.has(provider.info.key)) throw new Error(`Duplicate provider key ${provider.info.key}`);
    this.providers.set(provider.info.key, provider);
    return this;
  }

  get(key: string): StoreProvider | undefined {
    return this.providers.get(key);
  }

  require(key: string): StoreProvider {
    const p = this.providers.get(key);
    if (!p) throw new Error(`Unknown provider ${key}`);
    return p;
  }

  list(): StoreProvider[] {
    return [...this.providers.values()];
  }

  /** Providers that can actually deliver data (not UNSUPPORTED). */
  active(): StoreProvider[] {
    return this.list().filter((p) => p.info.supportStatus !== 'UNSUPPORTED');
  }

  /** Best available support status for a retailer across providers. */
  supportFor(retailerSlug: string): 'SUPPORTED' | 'EXPERIMENTAL' | 'UNSUPPORTED' {
    const statuses = this.list()
      .filter((p) => p.info.retailerSlugs.includes(retailerSlug) && p.info.dataOrigin !== 'DEVELOPMENT_SEED')
      .map((p) => p.info.supportStatus);
    if (statuses.includes('SUPPORTED')) return 'SUPPORTED';
    if (statuses.includes('EXPERIMENTAL')) return 'EXPERIMENTAL';
    return 'UNSUPPORTED';
  }
}

export interface RegistryOptions {
  environment: string;
  openPrices?: { enabled: boolean; userAgent: string; countries?: string[] } | null;
  partnerFeeds?: PartnerFeedConfig[];
  developmentSeed?: { now?: Date } | null;
}

export function createDefaultRegistry(options: RegistryOptions): ProviderRegistry {
  const registry = new ProviderRegistry();
  const retailerProviders: BaseStoreProvider[] = [
    new ColruytProvider(),
    new DelhaizeProvider(),
    new CarrefourProvider(),
    new AlbertHeijnProvider(),
    new JumboProvider(),
    ...otherRetailerProviders(),
  ];
  // A licensed partner feed replaces the UNSUPPORTED placeholder with the same key.
  const feedKeys = new Set((options.partnerFeeds ?? []).map((f) => f.key));
  for (const p of retailerProviders) if (!feedKeys.has(p.info.key)) registry.register(p);
  for (const feed of options.partnerFeeds ?? []) registry.register(new PartnerFeedProvider(feed));
  if (options.openPrices?.enabled) {
    registry.register(
      new OpenPricesProvider({
        userAgent: options.openPrices.userAgent,
        ...(options.openPrices.countries ? { countries: options.openPrices.countries } : {}),
      }),
    );
  }
  if (options.developmentSeed && options.environment !== 'production') {
    registry.register(
      new DevelopmentSeedProvider({
        environment: options.environment,
        ...(options.developmentSeed.now ? { now: options.developmentSeed.now } : {}),
      }),
    );
  }
  return registry;
}
