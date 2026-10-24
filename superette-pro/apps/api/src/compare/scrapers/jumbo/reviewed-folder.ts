import { createHash } from 'node:crypto';
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';

// Manually reviewed against both text and rendered pages of the user's PDF.
// This is a reviewed week-41 import, NOT a general PDF scraper.
export const PDF_SHA256 = 'aa6cc822aaf223d6972ec59247b56792296d2cf68c6378fc183394dc6efb5d83';
export const PDF_URL = 'https://www.jumbo.com/dam/belgie/2026/folders/Jumbo-BE-Instore-Folder-2026-Week-41.pdf';
export const STARTS_AT = '2026-10-06T22:00:00.000Z';
export const ENDS_AT = '2026-10-13T21:59:59.999Z';

type ReviewedItem = {
  name: string; brand: string | null; page: number;
  quantity: number | null; unit: 'G' | 'ML' | 'L' | 'PIECE' | null;
  packCount: number; oldCents: number; cents: number;
};

export const ITEMS: readonly ReviewedItem[] = [
  { name: 'Jumbo’s desembrood wit maïs', brand: 'Jumbo', page: 3, quantity: 600, unit: 'G', packCount: 1, oldCents: 299, cents: 224 },
  { name: 'Jumbo bloemkool', brand: 'Jumbo', page: 4, quantity: 1, unit: 'PIECE', packCount: 1, oldCents: 179, cents: 149 },
  { name: 'Jumbo scharrelkip kipborrelhapjes gekruid', brand: 'Jumbo', page: 5, quantity: 900, unit: 'G', packCount: 1, oldCents: 718, cents: 500 },
  { name: 'Brioche Pasquier pancakes naturel', brand: 'Brioche Pasquier', page: 6, quantity: 350, unit: 'G', packCount: 1, oldCents: 339, cents: 300 },
  // Eight persons is not an eight-piece package; quantity remains unknown.
  { name: 'Geruite pruimentaart', brand: null, page: 6, quantity: null, unit: null, packCount: 1, oldCents: 750, cents: 563 },
  { name: 'Nescafé Gold', brand: 'Nescafé', page: 11, quantity: 190, unit: 'G', packCount: 1, oldCents: 849, cents: 637 },
  { name: 'Fanta orange', brand: 'Fanta', page: 14, quantity: 1.5, unit: 'L', packCount: 4, oldCents: 849, cents: 637 },
  { name: 'NXT Level proteine caramel cookie bar', brand: 'NXT Level', page: 18, quantity: 55, unit: 'G', packCount: 1, oldCents: 249, cents: 187 },
  { name: 'Cabau Lifestyle crispy bar chocolate brownie', brand: 'Cabau Lifestyle', page: 18, quantity: 1, unit: 'PIECE', packCount: 1, oldCents: 329, cents: 247 },
  { name: 'Grand’Italia gnocchi mozzarella e pomodoro', brand: 'Grand’Italia', page: 18, quantity: 400, unit: 'G', packCount: 1, oldCents: 399, cents: 200 },
  { name: 'Heinz tomato, grana padano & masarpone pasta saus', brand: 'Heinz', page: 18, quantity: 350, unit: 'G', packCount: 1, oldCents: 379, cents: 190 },
];

export function assertReviewedPdf(bytes: Buffer): void {
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Geen PDF-bestand; geen feed geschreven.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== PDF_SHA256) throw new Error('Deze PDF is niet de gecontroleerde Belgische folder van week 41; geen feed geschreven.');
}

function productExternalId(item: ReviewedItem): string {
  // Same local identifier in both product and offer; no unchecked array lookup.
  return `folder-${createHash('sha256').update(JSON.stringify([item.name, item.quantity, item.unit, item.packCount])).digest('hex').slice(0, 24)}`;
}

export function buildReviewedJumboFeed(observedAt: Date): FeedFile {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('Ongeldige observatiedatum.');
  if (observedAt.getTime() < Date.parse(STARTS_AT) || observedAt.getTime() > Date.parse(ENDS_AT)) {
    throw new Error('Folder buiten geldigheidsperiode; niet als nieuwe actuele bron importeren.');
  }
  const products = ITEMS.map(item => ({
    // Local stable identifiers, not claimed retailer identifiers or EANs.
    externalId: productExternalId(item),
    name: item.name, brand: item.brand, barcode: null, imageUrl: null,
    productUrl: null, categoryPath: null, categorySlug: null,
    packageQuantity: item.quantity, packageUnit: item.unit, packCount: item.packCount,
    description: `Gecontroleerd prijsvoorbeeld in Belgische folder week 41, pagina ${item.page}.`,
  }));
  return feedFileSchema.parse({
    version: 1, chain: { slug: 'jumbo', name: 'Jumbo', websiteUrl: 'https://www.jumbo.com/nl-be' },
    source: { kind: 'MANUAL', termsReviewed: false,
      label: 'Jumbo België: gecontroleerde selectie folder week 41',
      notes: '11 handmatig gecontroleerde aanbiedingen voor één vaste verpakking uit de exact gecontroleerde PDF. Geen volledige catalogus of algemene PDF-scraper. EAN, categorie en productlink onbekend. Lokale identifiers zijn afgeleid van naam en verpakking. Alleen genoemde prijsvoorbeelden; niet alle varianten. Multibuy, wisselend gewicht en alcohol overgeslagen. Bestandswijzigingsdatum is geen bewijs van oorspronkelijke prijsvaststelling.',
    },
    observedAt: observedAt.toISOString(), locations: [], products,
    offers: ITEMS.map(item => ({
      productExternalId: productExternalId(item), locationExternalId: null,
      sourceReference: `2026-w41:p${item.page}:${productExternalId(item)}`,
      priceCents: item.cents, originalPriceCents: item.oldCents,
      promotionType: 'TEMPORARY', promotionText: 'Folderaanbieding: prijs voor 1 verpakking',
      promotionRule: { kind: 'FIXED_PRICE', priceCents: item.cents },
      channel: 'IN_STORE', availability: 'UNKNOWN', requiresLoyaltyCard: false,
      minimumQuantity: 1, startsAt: STARTS_AT, endsAt: ENDS_AT,
      observedAt: observedAt.toISOString(), confidence: 0.5,
      conditions: `Alleen het genoemde prijsvoorbeeld. Maximaal 4 dezelfde aanbiedingen per klant per bezoek. Alleen aanwezige varianten in Jumbo-winkels in België, zolang voorraad strekt. Prijs-, druk- en assortimentswijzigingen voorbehouden. Bron: ${PDF_URL}#page=${item.page}`,
    })),
  });
}
