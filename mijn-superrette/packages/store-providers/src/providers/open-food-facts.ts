import { normalizeGtin } from '@superrette/shared';

/**
 * Open Food Facts product metadata by barcode (API v3, ODbL). Used only to
 * give context for unknown barcodes — it never creates prices and never
 * silently creates canonical products.
 */
export interface ProductMetadata {
  gtin: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
}

export interface OpenFoodFactsOptions {
  userAgent: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class OpenFoodFactsClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenFoodFactsOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://world.openfoodfacts.org').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  async lookup(barcode: string): Promise<ProductMetadata | null> {
    const gtin = normalizeGtin(barcode);
    if (!gtin) return null;
    const url = `${this.baseUrl}/api/v3/product/${gtin}.json?fields=code,product_name,brands,quantity,image_front_url`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 4000);
    try {
      const res = await this.fetchImpl(url, {
        headers: { 'User-Agent': this.options.userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        status?: string;
        product?: { product_name?: string; brands?: string; quantity?: string; image_front_url?: string };
      };
      if (body.status !== 'success' || !body.product) return null;
      return {
        gtin,
        name: body.product.product_name?.trim() || null,
        brand: body.product.brands?.split(',')[0]?.trim() || null,
        quantity: body.product.quantity ?? null,
        imageUrl: body.product.image_front_url ?? null,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
