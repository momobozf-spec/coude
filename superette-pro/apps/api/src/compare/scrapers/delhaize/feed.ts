/**
 * Geparste Delhaize-producten → importbestand (`delhaize.json`).
 *
 * Het bestand gaat door exact dezelfde Zod-validatie als elk ander
 * importbestand; een ongeldig resultaat komt nooit op schijf.
 *
 * Bron en status:
 *  - `kind: IMPORT_FILE`, `termsReviewed: false` → de app toont deze prijzen
 *    als "niet geverifieerd" (status UNVERIFIED) tot een jurist de werkwijze
 *    heeft goedgekeurd en iemand dit bewust op `true` zet.
 *  - Kanaal `BOTH` met een expliciete voorwaarde: het is de webshopprijs; in
 *    de winkel kan ze afwijken. `ONLINE` zou de prijzen standaard verbergen in
 *    zoeken en mandje, terwijl Delhaize dezelfde productcatalogus voor beide
 *    gebruikt. De voorwaarde staat bij elke prijs zodat niemand misleid wordt.
 */
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { ParsedDelhaizeProduct } from './parse';

export const DELHAIZE_SOURCE_LABEL = 'Publieke productpagina’s delhaize.be (schema.org-gegevens)';

export function buildDelhaizeFeed(products: readonly ParsedDelhaizeProduct[], observedAt: Date): FeedFile {
  // Eén rij per productcode, ook als een product in meerdere categorieën stond.
  const unique = new Map<string, ParsedDelhaizeProduct>();
  for (const product of products) unique.set(product.externalId, product);

  const feed = {
    version: 1 as const,
    chain: {
      slug: 'delhaize',
      name: 'Delhaize',
      websiteUrl: 'https://www.delhaize.be',
      loyaltyCardName: 'SuperPlus',
    },
    source: {
      kind: 'IMPORT_FILE' as const,
      label: DELHAIZE_SOURCE_LABEL,
      termsReviewed: false,
      notes:
        'Automatisch verzameld uit de schema.org Product-gegevens op publieke productpagina’s, ' +
        'met respect voor robots.txt en een vertraging tussen verzoeken. Geen promoties: alleen de ' +
        'actuele webshopprijs. Geen afbeeldingen of omschrijvingen overgenomen.',
    },
    observedAt: observedAt.toISOString(),
    locations: [],
    products: [...unique.values()].map((product) => ({
      externalId: product.externalId,
      name: product.name,
      brand: product.brand,
      productUrl: product.productUrl,
      categoryPath: product.categoryPath,
      packageQuantity: product.packageQuantity,
      packageUnit: product.packageUnit,
      packCount: product.packCount,
    })),
    offers: [...unique.values()].map((product) => ({
      productExternalId: product.externalId,
      sourceReference: `${product.externalId}:web`,
      priceCents: product.priceCents,
      promotionType: 'NONE' as const,
      channel: 'BOTH' as const,
      conditions: 'Prijs van de Delhaize-webshop; in de winkel kan ze afwijken.',
      availability: product.availability,
      observedAt: observedAt.toISOString(),
      confidence: 0.8,
    })),
  };

  return feedFileSchema.parse(feed);
}
