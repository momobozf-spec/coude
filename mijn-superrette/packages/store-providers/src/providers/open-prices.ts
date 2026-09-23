import { normalizeGtin, stripDiacritics, toCents } from '@superrette/shared';
import { BaseStoreProvider } from '../base.js';
import { ProviderHttpError } from '../errors.js';
import type { PriceRequest, ProviderInfo, ProviderPrice } from '../types.js';

/**
 * Open Prices (https://prices.openfoodfacts.org) — crowdsourced prices from
 * receipts and price tags, published under the ODbL. This is a legitimate,
 * documented public API. Coverage in BE/NL is partial and prices are
 * user-reported; the UI labels them as such ("Gemeld door shoppers").
 *
 * Attribution required: "Prices: Open Prices by Open Food Facts, ODbL".
 */

export interface OpenPricesOptions {
  /** e.g. "MijnSuperrette/0.1 (contact@example.org)" — required by OFF policy. */
  userAgent: string;
  baseUrl?: string;
  countries?: string[];
  /** Minimum delay between requests (be a good citizen). */
  minIntervalMs?: number;
  fetch?: typeof fetch;
  /** Maximum age of prices to import. */
  maxAgeDays?: number;
}

interface OpenPricesItem {
  id: number;
  type?: string;
  product_code: string | null;
  price: number;
  price_is_discounted?: boolean | null;
  price_without_discount?: number | null;
  price_per?: string | null;
  currency: string;
  date: string;
  location_osm_id?: number | null;
  location_osm_type?: string | null;
  product?: {
    code?: string;
    product_name?: string | null;
    brands?: string | null;
    quantity?: string | null;
    image_url?: string | null;
  } | null;
  location?: { osm_brand?: string | null; osm_name?: string | null; osm_address_country_code?: string | null } | null;
}

interface OpenPricesPage {
  items: OpenPricesItem[];
  page: number;
  pages: number;
}

/** OSM brand names (normalised) -> retailer slug. */
const BRAND_TO_RETAILER: Record<string, string> = {
  colruyt: 'colruyt',
  'colruyt laagste prijzen': 'colruyt',
  okay: 'okay',
  delhaize: 'delhaize',
  'ad delhaize': 'delhaize',
  'proxy delhaize': 'delhaize',
  'shop n go': 'delhaize',
  carrefour: 'carrefour',
  'carrefour market': 'carrefour',
  'carrefour express': 'carrefour',
  'carrefour hypermarche': 'carrefour',
  'albert heijn': 'albert-heijn',
  ah: 'albert-heijn',
  'albert heijn to go': 'albert-heijn',
  lidl: 'lidl',
  aldi: 'aldi',
  'aldi nord': 'aldi',
  intermarche: 'intermarche',
  jumbo: 'jumbo',
  plus: 'plus',
  dirk: 'dirk',
  'dirk van den broek': 'dirk',
  spar: 'spar',
  dekamarkt: 'dekamarkt',
  vomar: 'vomar',
  'vomar voordeelmarkt': 'vomar',
  hoogvliet: 'hoogvliet',
  ekoplaza: 'ekoplaza',
  kruidvat: 'kruidvat',
  etos: 'etos',
};

export function retailerSlugForOsmBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  const key = stripDiacritics(brand)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return BRAND_TO_RETAILER[key] ?? null;
}

export class OpenPricesProvider extends BaseStoreProvider {
  readonly info: ProviderInfo = {
    key: 'open-prices',
    displayName: 'Open Prices (Open Food Facts)',
    retailerSlugs: [...new Set(Object.values(BRAND_TO_RETAILER))],
    supportStatus: 'SUPPORTED',
    reason:
      'Crowdsourced prices (ODbL). Coverage in Belgium and the Netherlands is partial; prices are user-reported with a date.',
    dataOrigin: 'CROWDSOURCED',
    capabilities: ['getPrices'],
    documentation: 'docs/STORE_PROVIDERS.md#open-prices',
  };

  private readonly baseUrl: string;
  private readonly countries: Set<string>;
  private readonly minIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private lastRequestAt = 0;

  constructor(private readonly options: OpenPricesOptions) {
    super();
    if (!options.userAgent || !/\(.+\)/.test(options.userAgent)) {
      throw new Error('OpenPricesProvider requires a User-Agent of the form "AppName/Version (contact)"');
    }
    this.baseUrl = (options.baseUrl ?? 'https://prices.openfoodfacts.org/api/v1').replace(/\/$/, '');
    this.countries = new Set((options.countries ?? ['BE', 'NL']).map((c) => c.toUpperCase()));
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  private async fetchPage(params: URLSearchParams): Promise<OpenPricesPage> {
    await this.throttle();
    const url = `${this.baseUrl}/prices?${params.toString()}`;
    const response = await this.fetchImpl(url, {
      headers: { 'User-Agent': this.options.userAgent, Accept: 'application/json' },
    });
    if (!response.ok) throw new ProviderHttpError(this.info.key, response.status, url);
    return (await response.json()) as OpenPricesPage;
  }

  /** Map one Open Prices item to a ProviderPrice, or null if it is outside scope. */
  mapItem(item: OpenPricesItem): ProviderPrice | null {
    if (item.type && item.type !== 'PRODUCT') return null;
    const gtin = item.product_code ? normalizeGtin(item.product_code) : null;
    if (!gtin) return null;
    const country = item.location?.osm_address_country_code?.toUpperCase();
    if (!country || !this.countries.has(country)) return null;
    const retailerSlug = retailerSlugForOsmBrand(item.location?.osm_brand ?? item.location?.osm_name);
    if (!retailerSlug) return null;
    if (item.currency !== 'EUR' || !(item.price > 0)) return null;

    const paid = toCents(item.price);
    const without = item.price_without_discount != null ? toCents(item.price_without_discount) : null;
    const discounted = Boolean(item.price_is_discounted) && without != null && without > paid;

    return {
      externalId: `off:${gtin}`,
      retailerSlug,
      observedAt: new Date(`${item.date}T12:00:00Z`),
      regularPriceCents: discounted ? without! : paid,
      promoPriceCents: discounted ? paid : null,
      currency: 'EUR',
      storeOsmId: item.location_osm_id != null ? `${item.location_osm_type ?? 'NODE'}:${item.location_osm_id}` : null,
      product: {
        externalId: `off:${gtin}`,
        retailerSlug,
        title: item.product?.product_name?.trim() || `GTIN ${gtin}`,
        brand: item.product?.brands?.split(',')[0]?.trim() || null,
        quantityText: item.product?.quantity ?? null,
        gtins: [gtin],
        imageUrl: item.product?.image_url ?? null,
      },
    };
  }

  override async *getPrices(request: PriceRequest): AsyncIterable<ProviderPrice> {
    const gtins = [
      ...new Set((request.gtins ?? []).map((g) => normalizeGtin(g)).filter((g): g is string => g !== null)),
    ];
    const since = request.since ?? new Date(Date.now() - (this.options.maxAgeDays ?? 90) * 24 * 3600 * 1000);
    for (const gtin of gtins) {
      let page = 1;
      let pages: number;
      do {
        const params = new URLSearchParams({
          product_code: gtin,
          date__gte: since.toISOString().slice(0, 10),
          order_by: '-date',
          size: '100',
          page: String(page),
        });
        const result = await this.fetchPage(params);
        pages = result.pages ?? 1;
        for (const item of result.items ?? []) {
          const mapped = this.mapItem(item);
          if (mapped) yield mapped;
        }
        page++;
      } while (page <= pages && page <= 5);
    }
  }
}
