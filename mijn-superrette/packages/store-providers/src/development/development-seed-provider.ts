import { DAY_MS, roundHalfUp } from '@superrette/shared';
import { BaseStoreProvider } from '../base.js';
import type {
  PriceRequest,
  ProviderAvailability,
  ProviderCategory,
  ProviderInfo,
  ProviderPrice,
  ProviderProduct,
  ProviderPromotion,
} from '../types.js';
import { DEV_CATEGORIES, DEV_PRODUCTS, DEV_PROMOTIONS, type DevListing, type DevRetailer } from './fixtures.js';

export interface DevelopmentSeedOptions {
  now?: Date;
  /** Refuse to run in production unless explicitly overridden (never do this). */
  environment?: string;
}

/** Small deterministic PRNG (mulberry32) so seeded history is reproducible. */
function prng(seedText: string): () => number {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ⚠️ Serves FICTITIOUS development data through the real StoreProvider
 * contract, so local environments exercise the full ingestion pipeline
 * (validation → normalisation → matching → observations). Every record is
 * tagged DEVELOPMENT_SEED. Disabled in production.
 */
export class DevelopmentSeedProvider extends BaseStoreProvider {
  readonly info: ProviderInfo = {
    key: 'development-seed',
    displayName: 'Development seed data (FICTITIOUS)',
    retailerSlugs: ['colruyt', 'delhaize', 'albert-heijn', 'lidl', 'jumbo', 'plus', 'dirk'],
    supportStatus: 'SUPPORTED',
    reason: 'Development only: fictitious sample data, never shown as live prices.',
    dataOrigin: 'DEVELOPMENT_SEED',
    capabilities: [
      'searchProducts',
      'getProduct',
      'getPrices',
      'getPromotions',
      'getCategories',
      'getAvailability',
      'listCatalog',
    ],
    documentation: 'docs/DATA_INGESTION.md#development-seed',
  };

  private readonly now: Date;
  /** Extra observations injected at runtime (dev tooling / vertical slice 3). */
  private readonly injected: ProviderPrice[] = [];

  constructor(options: DevelopmentSeedOptions = {}) {
    super();
    if (options.environment === 'production') {
      throw new Error('DevelopmentSeedProvider must never run in production');
    }
    this.now = options.now ?? new Date();
  }

  private *listings(): Generator<{ retailer: DevRetailer; listing: DevListing; gtin?: string; category: string }> {
    for (const product of DEV_PRODUCTS) {
      for (const [retailer, listing] of Object.entries(product.listings) as [DevRetailer, DevListing][]) {
        yield { retailer, listing, category: product.category, ...(product.gtin ? { gtin: product.gtin } : {}) };
      }
    }
  }

  private toProduct(retailer: DevRetailer, listing: DevListing, category: string, gtin?: string): ProviderProduct {
    return {
      externalId: listing.sku,
      retailerSlug: retailer,
      title: listing.title,
      brand: listing.brand ?? null,
      quantityText: listing.quantityText ?? null,
      gtins: gtin ? [gtin] : [],
      categoryText: category,
      isAvailable: true,
    };
  }

  override async *listCatalog(): AsyncIterable<ProviderProduct> {
    for (const { retailer, listing, category, gtin } of this.listings())
      yield this.toProduct(retailer, listing, category, gtin);
  }

  override async searchProducts(query: string): Promise<ProviderProduct[]> {
    const q = query.toLowerCase();
    const result: ProviderProduct[] = [];
    for (const { retailer, listing, category, gtin } of this.listings()) {
      if (listing.title.toLowerCase().includes(q)) result.push(this.toProduct(retailer, listing, category, gtin));
    }
    return result;
  }

  override async getProduct(externalId: string): Promise<ProviderProduct | null> {
    for (const { retailer, listing, category, gtin } of this.listings()) {
      if (listing.sku === externalId) return this.toProduct(retailer, listing, category, gtin);
    }
    return null;
  }

  /** Weekly observations for the past N weeks; the latest equals the fixture price. */
  history(retailer: DevRetailer, listing: DevListing): ProviderPrice[] {
    const random = prng(listing.sku);
    const weeks = listing.historyWeeks ?? 13;
    const points: ProviderPrice[] = [];
    for (let w = weeks; w >= 1; w--) {
      const observedAt = new Date(this.now.getTime() - w * 7 * DAY_MS);
      const drift = 1 + (random() - 0.55) * 0.12; // mostly slightly cheaper in the past
      const regular = Math.max(49, roundHalfUp((listing.price * drift) / 10) * 10 - 1);
      const promoWeek = random() < 0.18;
      points.push({
        externalId: listing.sku,
        retailerSlug: retailer,
        observedAt,
        regularPriceCents: regular,
        promoPriceCents: promoWeek ? roundHalfUp(regular * 0.8) : null,
      });
    }
    points.push({
      externalId: listing.sku,
      retailerSlug: retailer,
      observedAt: new Date(this.now.getTime() - 60 * 60 * 1000),
      regularPriceCents: listing.price,
      promoPriceCents: listing.promo ?? null,
    });
    return points;
  }

  override async *getPrices(request: PriceRequest = {}): AsyncIterable<ProviderPrice> {
    const wanted = request.externalIds ? new Set(request.externalIds) : null;
    for (const { retailer, listing } of this.listings()) {
      if (wanted && !wanted.has(listing.sku)) continue;
      for (const p of this.history(retailer, listing)) {
        if (!request.since || p.observedAt >= request.since) yield p;
      }
    }
    for (const p of this.injected) {
      if (!wanted || wanted.has(p.externalId)) yield p;
    }
  }

  /** Queue an extra observation for the next PRICES sync (dev tooling only). */
  injectPrice(price: ProviderPrice): void {
    this.injected.push(price);
  }

  override async *getPromotions(): AsyncIterable<ProviderPromotion> {
    for (const p of DEV_PROMOTIONS) {
      const skus = p.productKeys
        .map((key) => DEV_PRODUCTS.find((d) => d.key === key)?.listings[p.retailer]?.sku)
        .filter((s): s is string => Boolean(s));
      if (skus.length === 0) continue;
      yield {
        externalId: `dev-${p.externalId}`,
        retailerSlug: p.retailer,
        productExternalIds: skus,
        params: p.params,
        label: p.label,
        startsAt: new Date(this.now.getTime() + p.startsInDays * DAY_MS),
        endsAt: new Date(this.now.getTime() + p.endsInDays * DAY_MS),
        conditions: {
          loyaltyCardRequired: Boolean(p.loyaltyProgram),
          loyaltyProgram: p.loyaltyProgram ?? null,
          minQuantity: p.minQuantity ?? null,
          onlineOnly: false,
          regionCodes: [],
        },
      };
    }
  }

  override async getCategories(): Promise<ProviderCategory[]> {
    return DEV_CATEGORIES;
  }

  override async getAvailability(externalIds: string[]): Promise<ProviderAvailability[]> {
    return externalIds.map((externalId) => ({ externalId, isAvailable: true }));
  }
}
