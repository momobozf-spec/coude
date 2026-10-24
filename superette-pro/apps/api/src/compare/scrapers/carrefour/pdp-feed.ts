/**
 * Geparste Carrefour-productpagina's → importbestand (`carrefour.json`).
 *
 * Bron en status zoals bij ALDI en Delhaize: `IMPORT_FILE`, `termsReviewed: false`
 * (de app toont de prijzen als niet geverifieerd tot de voorwaarden door een
 * mens zijn nagekeken). Kanaal `ONLINE`: de getoonde prijs is de webprijs zonder
 * gekozen winkel.
 */
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { CarrefourPdpProduct } from './pdp';

export const CARREFOUR_PDP_SOURCE_LABEL = 'Publieke productpagina’s carrefour.be (schema.org-gegevens)';

export function buildCarrefourPdpFeed(products: readonly CarrefourPdpProduct[], observedAt: Date): FeedFile {
  const unique = new Map<string, CarrefourPdpProduct>();
  for (const product of products) {
    const existing = unique.get(product.externalId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(product)) {
      throw new Error(`Tegenstrijdige gegevens voor ${product.externalId}; geen feed geschreven`);
    }
    unique.set(product.externalId, product);
  }
  const list = [...unique.values()];
  return feedFileSchema.parse({
    version: 1,
    chain: { slug: 'carrefour', name: 'Carrefour', websiteUrl: 'https://www.carrefour.be' },
    source: {
      kind: 'IMPORT_FILE',
      termsReviewed: false,
      label: CARREFOUR_PDP_SOURCE_LABEL,
      notes:
        'Automatisch verzameld uit de schema.org Product-gegevens van publieke productpagina’s op carrefour.be ' +
        '(lijst uit de officiële sitemap), met respect voor robots.txt, identificatie als SuperetteBot en een ' +
        'vertraging tussen verzoeken. Een product wordt alleen opgenomen als schema.org, de zichtbare prijs en de ' +
        'paginametadata dezelfde prijs geven. Geen promoties, afbeeldingen of omschrijvingen overgenomen. Geen winkel gekozen.',
    },
    observedAt: observedAt.toISOString(),
    locations: [],
    products: list.map(({ priceCents: _price, availability: _availability, ...product }) => product),
    offers: list.map((product) => ({
      productExternalId: product.externalId,
      locationExternalId: null,
      sourceReference: `${product.externalId}:web`,
      priceCents: product.priceCents,
      originalPriceCents: null,
      promotionType: 'NONE',
      promotionText: null,
      promotionRule: null,
      channel: 'ONLINE',
      availability: product.availability,
      conditions: 'Getoonde Carrefour-webprijs zonder gekozen winkel. Kan per winkel, afhaalpunt of bestelmethode afwijken.',
      observedAt: observedAt.toISOString(),
      confidence: 0.7,
    })),
  });
}
