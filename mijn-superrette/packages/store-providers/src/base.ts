import { ProviderCapabilityError, ProviderUnsupportedError } from './errors.js';
import type {
  PriceRequest,
  ProviderAvailability,
  ProviderCategory,
  ProviderCapability,
  ProviderInfo,
  ProviderPrice,
  ProviderProduct,
  ProviderPromotion,
  SearchOptions,
  StoreProvider,
} from './types.js';

/**
 * Base class: every operation throws unless a subclass implements it and
 * lists it in `info.capabilities`.
 */
export abstract class BaseStoreProvider implements StoreProvider {
  abstract readonly info: ProviderInfo;

  protected fail(capability: ProviderCapability): never {
    if (this.info.supportStatus === 'UNSUPPORTED') {
      throw new ProviderUnsupportedError(this.info.key, this.info.reason ?? 'no permitted integration');
    }
    throw new ProviderCapabilityError(this.info.key, capability);
  }

  supports(capability: ProviderCapability): boolean {
    return this.info.supportStatus !== 'UNSUPPORTED' && this.info.capabilities.includes(capability);
  }

  async searchProducts(_query: string, _options?: SearchOptions): Promise<ProviderProduct[]> {
    return this.fail('searchProducts');
  }
  async getProduct(_externalId: string): Promise<ProviderProduct | null> {
    return this.fail('getProduct');
  }
  // eslint-disable-next-line require-yield
  async *getPrices(_request: PriceRequest): AsyncIterable<ProviderPrice> {
    this.fail('getPrices');
  }
  // eslint-disable-next-line require-yield
  async *getPromotions(_request?: { since?: Date }): AsyncIterable<ProviderPromotion> {
    this.fail('getPromotions');
  }
  async getCategories(): Promise<ProviderCategory[]> {
    return this.fail('getCategories');
  }
  async getAvailability(_externalIds: string[], _options?: { storeId?: string }): Promise<ProviderAvailability[]> {
    return this.fail('getAvailability');
  }
  // eslint-disable-next-line require-yield
  async *listCatalog(): AsyncIterable<ProviderProduct> {
    this.fail('listCatalog');
  }
}

/** A retailer for which no legal, reliable integration exists today. */
export class UnsupportedStoreProvider extends BaseStoreProvider {
  readonly info: ProviderInfo;
  constructor(info: Omit<ProviderInfo, 'supportStatus' | 'capabilities' | 'dataOrigin'> & { reason: string }) {
    super();
    this.info = { ...info, supportStatus: 'UNSUPPORTED', capabilities: [], dataOrigin: 'RETAILER_API' };
  }
}
