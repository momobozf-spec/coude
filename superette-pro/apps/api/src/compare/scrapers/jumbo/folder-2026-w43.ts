/**
 * Jumbo België — folder week 43 (woensdag 21 t/m dinsdag 27 oktober 2026).
 *
 * Gecontroleerde selectie, zoals week 41: geen algemene PDF-scraper. Elk item is
 * een "Prijsvoorbeeld" uit de folder waarvan de rekensom op de cent sluit:
 *   - oude totaalprijs is deelbaar door het aantal (gewone prijs per stuk);
 *   - actieprijs ÷ (aantal × inhoud) = de eenheidsprijs die Jumbo zelf vermeldt (±1 cent).
 * De koppeling naam ↔ prijs is daarnaast visueel nagekeken op pagina 3 en 8.
 * Overgeslagen: algemene acties zonder vaste verpakking, inhoud in stuks/rollen/zakjes,
 * eenheidsprijzen die niet kloppen (bv. M&M's p8), en alcohol.
 */
import { createHash } from 'node:crypto';
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';

export const W43_PDF_SHA256 = 'caa93bf39b682a5a75ceb79358600e400b34b37bac7caab621417749be65aa23';
export const W43_PDF_URL = 'https://www.jumbo.com/dam/belgie/2026/folders/Jumbo-BE-Instore-Folder-2026-Week-43.pdf';
export const W43_STARTS_AT = '2026-10-20T22:00:00.000Z'; // woensdag 21/10 00:00 Belgische tijd
export const W43_ENDS_AT = '2026-10-27T22:59:59.999Z'; // dinsdag 27/10 23:59:59 Belgische tijd (wintertijd vanaf 25/10)

export interface FolderItem {
  readonly page: number;
  readonly name: string;
  readonly label: string;
  readonly quantity: number;
  readonly unit: 'G' | 'KG' | 'ML' | 'CL' | 'L';
  readonly packCount: number;
  /** Aantal stuks waarvoor de actieprijs geldt (1 = gewone tijdelijke prijs). */
  readonly buy: number;
  readonly oldTotalCents: number;
  readonly promoTotalCents: number;
  readonly unitPriceCents: number;
  readonly per: 'kg' | 'l';
}

export const W43_ITEMS: readonly FolderItem[] = [
  { page: 1, name: 'XXL Nutrition fit yoghurt aardbei', label: 'XXL Nutrition fit yoghurt aardbei 200 gram', quantity: 200.0, unit: 'G', packCount: 1, buy: 4, oldTotalCents: 916, promoTotalCents: 458, unitPriceCents: 573, per: 'kg' },
  { page: 3, name: 'Délio kip curry', label: 'Délio kip curry 200 gram', quantity: 200.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 578, promoTotalCents: 289, unitPriceCents: 723, per: 'kg' },
  { page: 3, name: 'Entremont emmental geraspt', label: 'Entremont emmental geraspt 300 gram', quantity: 300.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 978, promoTotalCents: 489, unitPriceCents: 815, per: 'kg' },
  { page: 3, name: 'Galbani Parmigiano Reggiano kaas', label: 'Galbani Parmigiano Reggiano kaas 60 gram', quantity: 60.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 558, promoTotalCents: 279, unitPriceCents: 2325, per: 'kg' },
  { page: 3, name: 'Optimel magere kwark met magere yoghurt aardbei 0% vet', label: 'Optimel magere kwark met magere yoghurt aardbei 0% vet 500 gram', quantity: 500.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 598, promoTotalCents: 299, unitPriceCents: 299, per: 'kg' },
  { page: 4, name: 'Jumbo wokgroenten Cambodjaanse stijl', label: 'Jumbo wokgroenten Cambodjaanse stijl 400 gram', quantity: 400.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 798, promoTotalCents: 399, unitPriceCents: 499, per: 'kg' },
  { page: 4, name: 'Jumbo bio wortelen', label: 'Jumbo bio wortelen 750 gram', quantity: 750.0, unit: 'G', packCount: 1, buy: 3, oldTotalCents: 507, promoTotalCents: 338, unitPriceCents: 150, per: 'kg' },
  { page: 5, name: 'De Vegetarische Slager Auf Wieder Schnitzel vegan', label: 'De Vegetarische Slager Auf Wieder Schnitzel vegan 180 gram', quantity: 180.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 898, promoTotalCents: 449, unitPriceCents: 1247, per: 'kg' },
  { page: 5, name: 'Jumbo kipbucket mild', label: 'Jumbo kipbucket mild 600 gram', quantity: 600.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 1370, promoTotalCents: 1028, unitPriceCents: 857, per: 'kg' },
  { page: 6, name: 'Knorr spaghetteria pastagerecht carbonara', label: 'Knorr spaghetteria pastagerecht carbonara 154 gram', quantity: 154.0, unit: 'G', packCount: 1, buy: 5, oldTotalCents: 1145, promoTotalCents: 458, unitPriceCents: 595, per: 'kg' },
  { page: 6, name: 'Ben’s Original zoetzuur extra ananas', label: 'Ben’s Original zoetzuur extra ananas 450 gram', quantity: 450.0, unit: 'G', packCount: 1, buy: 4, oldTotalCents: 1196, promoTotalCents: 897, unitPriceCents: 498, per: 'kg' },
  { page: 6, name: 'Heinz tomato frito', label: 'Heinz tomato frito 780 gram', quantity: 780.0, unit: 'G', packCount: 1, buy: 3, oldTotalCents: 567, promoTotalCents: 378, unitPriceCents: 162, per: 'kg' },
  { page: 6, name: 'Manna curry saus', label: 'Manna curry saus 330 gram', quantity: 330.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 538, promoTotalCents: 404, unitPriceCents: 612, per: 'kg' },
  { page: 6, name: 'Solo patisserie', label: 'Solo patisserie 250 gram', quantity: 250.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 398, promoTotalCents: 299, unitPriceCents: 598, per: 'kg' },
  { page: 7, name: 'Dr. Oetker ristorante pizza salami', label: 'Dr. Oetker ristorante pizza salami 320 gram', quantity: 320.0, unit: 'G', packCount: 1, buy: 3, oldTotalCents: 855, promoTotalCents: 570, unitPriceCents: 594, per: 'kg' },
  { page: 7, name: 'Belviva oven frieten klassiek', label: 'Belviva oven frieten klassiek 600 gram', quantity: 600.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 798, promoTotalCents: 399, unitPriceCents: 333, per: 'kg' },
  { page: 8, name: 'Lotus frangipane', label: 'Lotus frangipane 8x52 gram', quantity: 52.0, unit: 'G', packCount: 8, buy: 3, oldTotalCents: 837, promoTotalCents: 670, unitPriceCents: 537, per: 'kg' },
  { page: 8, name: 'Doritos sweet chilli pepper tortilla chips', label: 'Doritos sweet chilli pepper tortilla chips 170 gram', quantity: 170.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 318, promoTotalCents: 254, unitPriceCents: 747, per: 'kg' },
  { page: 8, name: 'LU LULU beertje chocolade', label: 'LU LULU beertje chocolade 150 gram', quantity: 150.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 518, promoTotalCents: 389, unitPriceCents: 1297, per: 'kg' },
  { page: 8, name: 'Côte D’or original melkchocolade', label: 'Côte D’or original melkchocolade 400 gram', quantity: 400.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 878, promoTotalCents: 702, unitPriceCents: 878, per: 'kg' },
  { page: 9, name: 'Taksi tropisch fruit geen suiker toegevoegd', label: 'Taksi tropisch fruit geen suiker toegevoegd 1,5 l', quantity: 1.5, unit: 'L', packCount: 1, buy: 4, oldTotalCents: 796, promoTotalCents: 398, unitPriceCents: 66, per: 'l' },
  { page: 9, name: 'Chaudfontaine mineraalwater koolzuurvrij', label: 'Chaudfontaine mineraalwater koolzuurvrij 6x1,5 l', quantity: 1.5, unit: 'L', packCount: 6, buy: 3, oldTotalCents: 1767, promoTotalCents: 1178, unitPriceCents: 44, per: 'l' },
  { page: 10, name: 'Dettol Power & Fresh allesreiniger sprankelende citroen & limoen', label: 'Dettol Power & Fresh allesreiniger sprankelende citroen & limoen 1 l', quantity: 1.0, unit: 'L', packCount: 1, buy: 2, oldTotalCents: 504, promoTotalCents: 252, unitPriceCents: 126, per: 'l' },
  { page: 10, name: 'Vanish pre-treat tough stain spray', label: 'Vanish pre-treat tough stain spray 500 ml', quantity: 500.0, unit: 'ML', packCount: 1, buy: 2, oldTotalCents: 1582, promoTotalCents: 791, unitPriceCents: 791, per: 'l' },
  { page: 11, name: 'Gillette classic sensitive scheergel', label: 'Gillette classic sensitive scheergel 200 ml', quantity: 200.0, unit: 'ML', packCount: 1, buy: 2, oldTotalCents: 630, promoTotalCents: 315, unitPriceCents: 788, per: 'l' },
  { page: 11, name: 'WC Eend Nr1 ontkalker', label: 'WC Eend Nr1 ontkalker 750 ml', quantity: 750.0, unit: 'ML', packCount: 1, buy: 2, oldTotalCents: 750, promoTotalCents: 375, unitPriceCents: 250, per: 'l' },
  { page: 13, name: 'Jumbo gesneden prei', label: 'Jumbo gesneden prei 400 gram', quantity: 400.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 366, promoTotalCents: 275, unitPriceCents: 344, per: 'kg' },
  { page: 14, name: 'Belfond rundsfond biologisch', label: 'Belfond rundsfond biologisch 240 ml', quantity: 240.0, unit: 'ML', packCount: 1, buy: 2, oldTotalCents: 738, promoTotalCents: 554, unitPriceCents: 1154, per: 'l' },
  { page: 14, name: 'D&L mayonaise met eieren knijpfles', label: 'D&L mayonaise met eieren knijpfles 450 ml', quantity: 450.0, unit: 'ML', packCount: 1, buy: 2, oldTotalCents: 530, promoTotalCents: 398, unitPriceCents: 442, per: 'l' },
  { page: 14, name: 'Jumbo aardappelschijfjes', label: 'Jumbo aardappelschijfjes 600 gram', quantity: 600.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 170, promoTotalCents: 85, unitPriceCents: 71, per: 'kg' },
  { page: 14, name: 'The Potato Chef zoete aardappelkroketten', label: 'The Potato Chef zoete aardappelkroketten 420 gram', quantity: 420.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 1158, promoTotalCents: 811, unitPriceCents: 965, per: 'kg' },
  { page: 15, name: 'Jumbo lasagnette', label: 'Jumbo lasagnette 900 gram', quantity: 900.0, unit: 'G', packCount: 1, buy: 1, oldTotalCents: 859, promoTotalCents: 644, unitPriceCents: 716, per: 'kg' },
  { page: 18, name: 'Lutti fili-tubs aardbei', label: 'Lutti fili-tubs aardbei 80 gram', quantity: 80.0, unit: 'G', packCount: 1, buy: 2, oldTotalCents: 318, promoTotalCents: 159, unitPriceCents: 994, per: 'kg' },
  { page: 18, name: 'Mars Minimix chocolade repen uitdeelzak', label: 'Mars Minimix chocolade repen uitdeelzak 500 gram', quantity: 500.0, unit: 'G', packCount: 1, buy: 3, oldTotalCents: 1377, promoTotalCents: 918, unitPriceCents: 612, per: 'kg' },
  { page: 19, name: 'Melitta crema intense', label: 'Melitta crema intense 1 kg', quantity: 1.0, unit: 'KG', packCount: 1, buy: 2, oldTotalCents: 3998, promoTotalCents: 1999, unitPriceCents: 1000, per: 'kg' },
];

const GRAMS_OR_ML: Record<FolderItem['unit'], number> = { G: 1, KG: 1000, ML: 1, CL: 10, L: 1000 };

/** Controleert de rekensom van één item; geeft de reden terug als ze niet sluit. */
export function checkFolderItem(item: FolderItem): string | null {
  if (item.oldTotalCents % item.buy !== 0) return 'oude prijs niet deelbaar door het aantal';
  if (item.promoTotalCents <= 0 || item.promoTotalCents > item.oldTotalCents) return 'actieprijs niet lager dan de gewone prijs';
  const isMass = item.unit === 'G' || item.unit === 'KG';
  if (isMass !== (item.per === 'kg')) return 'eenheid past niet bij de eenheidsprijs';
  const base = item.quantity * GRAMS_OR_ML[item.unit] * item.packCount * item.buy;
  const expected = Math.round((item.promoTotalCents * 1000) / base);
  return Math.abs(expected - item.unitPriceCents) <= 1 ? null : `eenheidsprijs klopt niet (${expected} vs ${item.unitPriceCents})`;
}

function externalId(item: FolderItem): string {
  return `folder-${createHash('sha256').update(JSON.stringify([item.name, item.quantity, item.unit, item.packCount])).digest('hex').slice(0, 24)}`;
}

export function assertW43Pdf(bytes: Buffer): void {
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Geen PDF-bestand; geen feed geschreven.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== W43_PDF_SHA256) throw new Error('Deze PDF is niet de gecontroleerde Belgische folder van week 43; geen feed geschreven.');
}

export function buildJumboW43Feed(observedAt: Date): FeedFile {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('Ongeldige observatiedatum.');
  if (observedAt.getTime() < Date.parse(W43_STARTS_AT) || observedAt.getTime() > Date.parse(W43_ENDS_AT)) {
    throw new Error('Folder buiten geldigheidsperiode; niet als actuele bron importeren.');
  }
  for (const item of W43_ITEMS) {
    const problem = checkFolderItem(item);
    if (problem) throw new Error(`${item.label}: ${problem}; geen feed geschreven.`);
  }
  const seen = new Set<string>();
  const items = W43_ITEMS.filter((item) => { const id = externalId(item); if (seen.has(id)) return false; seen.add(id); return true; });
  return feedFileSchema.parse({
    version: 1,
    chain: { slug: 'jumbo', name: 'Jumbo', websiteUrl: 'https://www.jumbo.com/nl-be' },
    source: {
      kind: 'MANUAL', termsReviewed: false,
      label: 'Jumbo België: gecontroleerde selectie folder week 43',
      notes: `${items.length} prijsvoorbeelden uit de Belgische folder van week 43 (21-27 oktober 2026), elk met sluitende rekensom (gewone prijs, actieprijs en Jumbo's eigen eenheidsprijs). Geen volledige catalogus of algemene PDF-scraper. EAN, merk, categorie en productlink onbekend. Alleen het genoemde prijsvoorbeeld, niet alle varianten. Alcohol en acties zonder vaste verpakking overgeslagen.`,
    },
    observedAt: observedAt.toISOString(),
    locations: [],
    products: items.map((item) => ({
      externalId: externalId(item), name: item.name, brand: null, barcode: null, imageUrl: null,
      productUrl: null, categoryPath: null, categorySlug: null,
      packageQuantity: item.quantity, packageUnit: item.unit, packCount: item.packCount,
      description: `Prijsvoorbeeld in de Belgische Jumbo-folder week 43, pagina ${item.page}: ${item.label}.`,
    })),
    offers: items.map((item) => {
      const single = item.buy === 1;
      const regularCents = item.oldTotalCents / item.buy;
      return {
        productExternalId: externalId(item), locationExternalId: null,
        sourceReference: `2026-w43:p${item.page}:${externalId(item)}`,
        priceCents: single ? item.promoTotalCents : regularCents,
        originalPriceCents: single ? item.oldTotalCents : null,
        promotionType: single ? 'TEMPORARY' : 'MULTIBUY',
        promotionText: single ? 'Folderaanbieding' : `${item.buy} voor €${(item.promoTotalCents / 100).toFixed(2).replace('.', ',')}`,
        promotionRule: single
          ? { kind: 'FIXED_PRICE', priceCents: item.promoTotalCents }
          : { kind: 'MULTIBUY', quantity: item.buy, totalCents: item.promoTotalCents },
        channel: 'IN_STORE', availability: 'UNKNOWN', requiresLoyaltyCard: false,
        minimumQuantity: 1, startsAt: W43_STARTS_AT, endsAt: W43_ENDS_AT,
        observedAt: observedAt.toISOString(), confidence: 0.5,
        conditions: `Alleen het genoemde prijsvoorbeeld. Maximaal 4 dezelfde aanbiedingen per klant per bezoek. Alle combinaties binnen de actie mogelijk volgens de folder. Alleen in Jumbo-winkels in België, zolang de voorraad strekt. Bron: ${W43_PDF_URL}#page=${item.page}`,
      };
    }),
  });
}
