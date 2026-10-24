/**
 * Geparste Lidl-tegels → importbestand (`lidl.json`, sleutel van de Lidl-adapter).
 *
 * Gaat door dezelfde Zod-validatie als elk ander importbestand.
 *
 *  - `termsReviewed: false` → status UNVERIFIED tot een jurist de werkwijze
 *    goedkeurt en iemand dit bewust op `true` zet.
 *  - Kanaal `IN_STORE`: de online categoriepagina toont weekacties die alleen
 *    in de winkel gelden ("Enkel in de winkel van 09/10 - 10/10").
 *  - `startsAt`/`endsAt` uit Lidl's eigen actieperiode: na afloop toont de
 *    app de prijs als verlopen en rekent ze niet meer mee.
 *  - Lidl Plus is een aparte aanbieding met `requiresLoyaltyCard`.
 */
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { ParsedLidlOffer, ParsedLidlProduct } from './parse';

export const LIDL_SOURCE_LABEL = 'Publieke categoriepagina’s lidl.be (tegelgegevens)';

export interface LidlTile {
  readonly product: ParsedLidlProduct;
  readonly offers: readonly ParsedLidlOffer[];
}

export function buildLidlFeed(tiles: readonly LidlTile[], observedAt: Date): FeedFile {
  // Eén rij per productcode, ook als een product in meerdere categorieën stond.
  const unique = new Map<string, LidlTile>();
  for (const tile of tiles) unique.set(tile.product.externalId, tile);
  const observed = observedAt.toISOString();

  const feed = {
    version: 1 as const,
    chain: {
      slug: 'lidl',
      name: 'Lidl',
      websiteUrl: 'https://www.lidl.be',
      loyaltyCardName: 'Lidl Plus',
    },
    source: {
      kind: 'IMPORT_FILE' as const,
      label: LIDL_SOURCE_LABEL,
      termsReviewed: false,
      notes:
        'Automatisch verzameld uit de tegelgegevens op publieke categoriepagina’s, met respect voor ' +
        'robots.txt en een vertraging tussen verzoeken. Weekacties in de winkel met hun actieperiode; ' +
        'geen vast assortiment. Geen EAN beschikbaar. Geen afbeeldingen of omschrijvingen overgenomen.',
    },
    observedAt: observed,
    locations: [],
    products: [...unique.values()].map(({ product }) => ({
      externalId: product.externalId,
      name: product.name,
      brand: product.brand,
      productUrl: product.productUrl,
      categoryPath: product.categoryPath,
      packageQuantity: product.packageQuantity,
      packageUnit: product.packageUnit,
      packCount: product.packCount,
    })),
    offers: [...unique.values()].flatMap(({ product, offers }) =>
      offers.map((offer) => ({
        productExternalId: product.externalId,
        sourceReference: `${product.externalId}:${offer.kind === 'LIDL_PLUS' ? 'lidlplus' : 'winkel'}`,
        priceCents: offer.priceCents,
        originalPriceCents: offer.originalPriceCents,
        promotionType: offer.promotionType,
        promotionText: offer.promotionText,
        promotionRule: offer.promotionRule,
        requiresLoyaltyCard: offer.requiresLoyaltyCard,
        conditions: offer.conditions,
        channel: 'IN_STORE' as const,
        availability: 'UNKNOWN' as const,
        startsAt: product.startsAt,
        endsAt: product.endsAt,
        observedAt: observed,
        confidence: 0.8,
      })),
    ),
  };

  return feedFileSchema.parse(feed);
}
