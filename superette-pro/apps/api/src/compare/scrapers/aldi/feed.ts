/**
 * Geparste ALDI België-producten → importbestand (`aldi.json`).
 *
 * Sleutel en slug `aldi`, zoals `adapters/aldi.adapter.ts`, zodat
 * `npm run compare:sync -- aldi` het bestand oppikt.
 *
 * Bron en status zoals bij Delhaize: `IMPORT_FILE`, `termsReviewed: false`
 * (de app toont de prijzen als niet geverifieerd). Kanaal `IN_STORE`: de
 * productpagina's op aldi.be hebben geen winkelmand (vastgesteld 7 oktober
 * 2026), de getoonde prijs is dus die in de winkel.
 */
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { ParsedAldiProduct } from './parse';

export const ALDI_SOURCE_LABEL = 'Publieke productpagina’s aldi.be (schema.org-gegevens)';

export function buildAldiFeed(products: readonly ParsedAldiProduct[], observedAt: Date): FeedFile {
  const unique = new Map<string, ParsedAldiProduct>();
  for (const product of products) if (!unique.has(product.externalId)) unique.set(product.externalId, product);

  const feed = {
    version: 1 as const,
    chain: {
      slug: 'aldi',
      name: 'ALDI',
      websiteUrl: 'https://www.aldi.be',
    },
    source: {
      kind: 'IMPORT_FILE' as const,
      label: ALDI_SOURCE_LABEL,
      termsReviewed: false,
      notes:
        'Automatisch verzameld uit de schema.org Product-gegevens en de zichtbare verkoopeenheid op publieke ' +
        'productpagina’s van aldi.be (lijst uit de officiële sitemap), met respect voor robots.txt en een ' +
        'vertraging tussen verzoeken. Geen promoties. Geen afbeeldingen of omschrijvingen overgenomen.',
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
      sourceReference: `${product.externalId}:winkel`,
      priceCents: product.priceCents,
      promotionType: 'NONE' as const,
      channel: 'IN_STORE' as const,
      conditions: 'Winkelprijs zoals vermeld op aldi.be; kan per winkel afwijken.',
      availability: product.availability,
      observedAt: observedAt.toISOString(),
      confidence: 0.8,
    })),
  };

  return feedFileSchema.parse(feed);
}
