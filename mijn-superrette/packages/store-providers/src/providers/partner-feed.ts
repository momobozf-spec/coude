import { z } from 'zod';
import { BaseStoreProvider } from '../base.js';
import { ProviderHttpError } from '../errors.js';
import {
  providerPriceSchema,
  providerProductSchema,
  providerPromotionSchema,
  type ProviderInfo,
  type ProviderPrice,
  type ProviderProduct,
  type ProviderPromotion,
} from '../types.js';

/**
 * PartnerFeedProvider ingests a licensed JSON feed supplied by a retailer or
 * approved via an affiliate programme. It is deliberately generic: once a
 * retailer grants written permission, operations configures the feed URL and
 * credentials through environment variables — no code change, and no
 * credentials in Git.
 *
 * Feed format (documented in docs/STORE_PROVIDERS.md#partner-feeds):
 *   { "products": ProviderProduct[], "prices": ProviderPrice[], "promotions": ProviderPromotion[] }
 * with ISO date strings.
 */
export interface PartnerFeedConfig {
  key: string;
  displayName: string;
  retailerSlugs: string[];
  url: string;
  /** e.g. { Authorization: 'Bearer …' } — read from the environment, never committed. */
  headers?: Record<string, string>;
  dataOrigin: 'RETAILER_API' | 'AFFILIATE_FEED';
  /** Reference to the signed agreement/approval (ticket, contract number). Mandatory. */
  licenseReference: string;
  fetch?: typeof fetch;
}

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.date()).transform((s) => new Date(s));

const feedSchema = z.object({
  products: z.array(providerProductSchema).default([]),
  prices: z
    .array(z.looseObject({ observedAt: isoDate }))
    .default([]),
  promotions: z
    .array(z.looseObject({ startsAt: isoDate.nullish(), endsAt: isoDate.nullish() }))
    .default([]),
});

export class PartnerFeedProvider extends BaseStoreProvider {
  readonly info: ProviderInfo;
  private cache: z.output<typeof feedSchema> | null = null;

  constructor(private readonly config: PartnerFeedConfig) {
    super();
    if (!config.licenseReference?.trim()) {
      throw new Error(`PartnerFeedProvider "${config.key}" requires a licenseReference documenting permission to use the feed`);
    }
    this.info = {
      key: config.key,
      displayName: config.displayName,
      retailerSlugs: config.retailerSlugs,
      supportStatus: 'EXPERIMENTAL',
      reason: `Licensed feed (${config.licenseReference}). Validate data quality before promoting to SUPPORTED.`,
      dataOrigin: config.dataOrigin,
      capabilities: ['listCatalog', 'getPrices', 'getPromotions'],
      documentation: 'docs/STORE_PROVIDERS.md#partner-feeds',
    };
  }

  private async load(): Promise<z.output<typeof feedSchema>> {
    if (this.cache) return this.cache;
    const res = await (this.config.fetch ?? fetch)(this.config.url, { headers: { Accept: 'application/json', ...this.config.headers } });
    if (!res.ok) throw new ProviderHttpError(this.info.key, res.status, this.config.url);
    this.cache = feedSchema.parse(await res.json());
    return this.cache;
  }

  override async *listCatalog(): AsyncIterable<ProviderProduct> {
    yield* (await this.load()).products;
  }

  override async *getPrices(): AsyncIterable<ProviderPrice> {
    // Records are yielded as-is; the pipeline validates each one individually.
    for (const p of (await this.load()).prices) yield p as unknown as ProviderPrice;
  }

  override async *getPromotions(): AsyncIterable<ProviderPromotion> {
    for (const p of (await this.load()).promotions) yield p as unknown as ProviderPromotion;
  }
}

export { providerPriceSchema, providerPromotionSchema };
