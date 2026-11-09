import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { CarrefourProduct } from './parse';

export function buildCarrefourFeed(products: readonly CarrefourProduct[], observedAt: Date): FeedFile {
  const unique = new Map<string, CarrefourProduct>();
  for (const product of products) {
    const existing = unique.get(product.externalId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(product)) throw new Error(`Tegenstrijdige gegevens voor ${product.externalId}; geen feed geschreven`);
    unique.set(product.externalId, product);
  }
  return feedFileSchema.parse({
    version: 1,
    chain: { slug: 'carrefour', name: 'Carrefour', websiteUrl: 'https://www.carrefour.be' },
    source: {
      kind: 'IMPORT_FILE', termsReviewed: false,
      label: 'Zelf opgeslagen Carrefour-webpagina’s; winkel onbekend',
      notes: 'Zichtbare webprijzen uit zelf opgeslagen carrefour.be-pagina’s. Geen winkel gekozen of bevestigd. Geen nationale of lokale winkelprijsgarantie. Promotietegels en eenheidsprijzen worden overgeslagen. Tijdstip is conservatief de oudste bestandswijzigingsdatum, geen bewijs van oorspronkelijke prijsvaststelling.',
    },
    observedAt: observedAt.toISOString(), locations: [],
    products: [...unique.values()].map(({ priceCents, ...product }) => product),
    offers: [...unique.values()].map(product => ({
      productExternalId: product.externalId, locationExternalId: null,
      sourceReference: `${product.externalId}:web`, priceCents: product.priceCents,
      originalPriceCents: null, promotionType: 'NONE', promotionText: null,
      promotionRule: null, channel: 'ONLINE', availability: 'UNKNOWN',
      conditions: 'Getoonde Carrefour-webprijs zonder gekozen winkel. Kan per winkel, afhaalpunt of bestelmethode afwijken.',
      observedAt: observedAt.toISOString(), confidence: 0.5,
    })),
  });
}
