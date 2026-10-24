/**
 * Bouwstenen voor unit-tests van de vergelijker: DTO's zonder database.
 */
import type { CatalogProductSummary, ProductOffer, StoreChainRef } from '@superette/contracts';

export const CHAINS: Readonly<Record<string, StoreChainRef>> = Object.freeze({
  delhaize: { id: 'c-delhaize', slug: 'delhaize', name: 'Delhaize', logoUrl: null },
  lidl: { id: 'c-lidl', slug: 'lidl', name: 'Lidl', logoUrl: null },
  colruyt: { id: 'c-colruyt', slug: 'colruyt', name: 'Colruyt', logoUrl: null },
});

export function product(overrides: Partial<CatalogProductSummary> & { id: string }): CatalogProductSummary {
  return {
    name: 'Coca-Cola Zero',
    brand: 'Coca-Cola',
    brandType: 'NATIONAL_BRAND',
    categoryId: 'dranken',
    categorySlug: 'dranken',
    categoryName: 'Dranken',
    imageUrl: null,
    barcode: null,
    packageLabel: '1,5 l',
    normalizedQuantity: 1500,
    normalizedUnit: 'L',
    packCount: 1,
    ...overrides,
  };
}

let offerCounter = 0;

export function offer(overrides: Partial<ProductOffer> & { storeChain: StoreChainRef; priceCents: number }): ProductOffer {
  offerCounter++;
  const observedAt = new Date('2026-10-04T08:00:00.000Z').toISOString();
  return {
    id: `offer-${offerCounter}`,
    storeLocation: null,
    storeProductName: 'Coca-Cola Zero 1,5 l',
    productUrl: null,
    imageUrl: null,
    originalPriceCents: null,
    discountPercentage: null,
    unitPrice: { cents: Math.round((overrides.priceCents * 1000) / 1500), unit: 'L' },
    unitPriceUnavailableReason: null,
    promotionType: 'NONE',
    promotionLabel: null,
    promotionRule: null,
    conditions: null,
    requiresLoyaltyCard: false,
    isPersonalized: false,
    channel: 'BOTH',
    minimumQuantity: 1,
    effectivePrice: null,
    depositCents: null,
    availability: 'IN_STOCK',
    provenance: {
      sourceKind: 'IMPORT_FILE',
      sourceLabel: 'Testbestand',
      sourceReference: null,
      observedAt,
      validFrom: null,
      validUntil: null,
      confidence: 1,
      status: 'CURRENT',
      isDemo: false,
    },
    ...overrides,
  };
}
