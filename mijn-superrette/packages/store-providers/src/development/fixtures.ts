import { gtinCheckDigit } from '@superrette/shared';
import type { PromotionParams } from '@superrette/domain';

/**
 * ⚠️ DEVELOPMENT DATA — FICTITIOUS PRICES ⚠️
 *
 * Everything in this file is invented sample data for local development,
 * demos and tests. Prices do not reflect real shelf prices. Barcodes use the
 * GS1 restricted-circulation range (prefix 2), so they can never collide with
 * a real product. All records are ingested with dataOrigin DEVELOPMENT_SEED
 * and the apps label them "VOORBEELDDATA".
 */

/** Deterministic, valid GTIN-13 in the restricted range 20xxxxxxxxxxC. */
export function devGtin(n: number): string {
  const body = `20${String(n).padStart(10, '0')}`;
  return `${body}${gtinCheckDigit(body)}`;
}

export interface DevListing {
  sku: string;
  title: string;
  brand?: string;
  quantityText?: string;
  /** Current regular price in cents. */
  price: number;
  /** Current shelf promo price in cents. */
  promo?: number;
  /** Weeks of history to generate (default 13). */
  historyWeeks?: number;
}

export interface DevProduct {
  key: string;
  category: string;
  gtin?: string;
  listings: Partial<Record<DevRetailer, DevListing>>;
}

export type DevRetailer = 'colruyt' | 'delhaize' | 'albert-heijn' | 'lidl' | 'jumbo' | 'plus' | 'dirk';

export const DEV_RETAILERS: DevRetailer[] = ['colruyt', 'delhaize', 'albert-heijn', 'lidl', 'jumbo', 'plus', 'dirk'];

const same = (
  key: string,
  category: string,
  gtinNo: number,
  titles: Partial<Record<DevRetailer, [title: string, price: number, promo?: number]>>,
  brand?: string,
): DevProduct => ({
  key,
  category,
  gtin: devGtin(gtinNo),
  listings: Object.fromEntries(
    Object.entries(titles).map(([retailer, [title, price, promo]]) => [
      retailer,
      { sku: `${retailer}-${key}`, title, price, ...(promo ? { promo } : {}), ...(brand ? { brand } : {}) },
    ]),
  ),
});

const own = (
  key: string,
  category: string,
  retailer: DevRetailer,
  title: string,
  price: number,
  extra: Partial<DevListing> & { gtinNo?: number } = {},
): DevProduct => {
  const { gtinNo, ...listing } = extra;
  return {
    key,
    category,
    ...(gtinNo ? { gtin: devGtin(gtinNo) } : {}),
    listings: { [retailer]: { sku: `${retailer}-${key}`, title, price, ...listing } },
  };
};

export const DEV_PRODUCTS: DevProduct[] = [
  // ── Frisdrank ──────────────────────────────────────────────────────────
  same('coca-cola-zero-15', 'frisdrank', 1, {
    colruyt: ['Coca-Cola Zero Sugar 1,5L', 219],
    delhaize: ['Coca-Cola Zero fles 1,5 liter', 259],
    'albert-heijn': ['Coca-Cola Zero sugar 1.5 L', 249],
    lidl: ['Coca-Cola Zero Sugar PET 1,5 l', 229],
    jumbo: ['Coca Cola Zero Sugar 1500ml', 259],
    plus: ['Coca-Cola Zero 1,5 liter', 239],
    dirk: ['Coca-Cola Zero Sugar fles 1,5 liter', 229, 199],
  }),
  same('coca-cola-original-15', 'frisdrank', 2, {
    colruyt: ['Coca-Cola Original 1,5L', 229],
    delhaize: ['Coca-Cola Regular fles 1,5 liter', 269],
    'albert-heijn': ['Coca-Cola Original taste 1.5 L', 259],
    jumbo: ['Coca Cola Original 1500ml', 265],
    dirk: ['Coca-Cola 1,5 liter', 239],
  }),
  same('coca-cola-zero-6x33', 'frisdrank', 3, {
    colruyt: ['Coca-Cola Zero Sugar blik 6x33cl', 519],
    delhaize: ['Coca-Cola Zero canettes 6 x 33 cl', 579],
    'albert-heijn': ['Coca-Cola Zero sugar 6 x 330 ml', 549],
    jumbo: ['Coca-Cola Zero Sugar 6 x 33cl', 559],
  }),
  // ── Zuivel ─────────────────────────────────────────────────────────────
  own('boni-halfvolle-melk-1l', 'zuivel', 'colruyt', 'Boni Halfvolle Melk 1L', 105, { gtinNo: 10 }),
  own('delhaize-halfvolle-melk-1l', 'zuivel', 'delhaize', 'Delhaize Lait demi-écrémé / Halfvolle melk 1 L', 115, {
    gtinNo: 11,
  }),
  own('ah-halfvolle-melk-1l', 'zuivel', 'albert-heijn', 'AH Halfvolle melk', 109, {
    quantityText: '1 liter',
    gtinNo: 12,
  }),
  own('milbona-halfvolle-melk-1l', 'zuivel', 'lidl', 'Milbona Halfvolle melk 1 l', 99, { gtinNo: 13, historyWeeks: 3 }),
  own('jumbo-halfvolle-melk-1l', 'zuivel', 'jumbo', 'Jumbo Halfvolle Melk 1L', 109, { gtinNo: 14 }),
  own('ah-halfvolle-melk-2l', 'zuivel', 'albert-heijn', 'AH Halfvolle melk 2 liter', 205, { gtinNo: 15 }),
  own('boni-volle-melk-1l', 'zuivel', 'colruyt', 'Boni Volle Melk 1L', 119, { gtinNo: 16 }),
  same('campina-halfvolle-melk-1l', 'zuivel', 20, {
    delhaize: ['Campina Halfvolle Melk 1L', 159],
    'albert-heijn': ['Campina Halfvolle melk 1 liter', 149],
    jumbo: ['Campina Halfvolle Melk 1 L', 145],
  }),
  same(
    'arla-lactofree-halfvol-1l',
    'zuivel',
    21,
    {
      colruyt: ['Arla Lactofree halfvolle melk lactosevrij 1L', 189],
      delhaize: ['Arla Lactofree lait demi-écrémé sans lactose 1L', 199],
      'albert-heijn': ['Arla Lactofree Halfvolle melk lactosevrij 1 liter', 195],
      jumbo: ['Arla Lactofree halfvolle melk lactosevrij 1L', 189],
    },
    'Arla',
  ),
  same(
    'philadelphia-original-200',
    'zuivel',
    22,
    {
      colruyt: ['Philadelphia Original 200g', 249],
      delhaize: ['Philadelphia Original 200 g', 279],
      'albert-heijn': ['Philadelphia Original roomkaas 200 g', 269],
      lidl: ['Philadelphia Original 200 g', 259],
      jumbo: ['Philadelphia Original 200g', 265],
    },
    'Philadelphia',
  ),
  // ── Brood ──────────────────────────────────────────────────────────────
  own('boni-volkoren-brood', 'brood', 'colruyt', 'Boni volkorenbrood gesneden 800g', 189, { gtinNo: 30 }),
  own('delhaize-volkoren-brood', 'brood', 'delhaize', 'Delhaize Pain complet / Volkoren brood 800 g', 209, {
    gtinNo: 31,
  }),
  own('ah-volkoren-brood', 'brood', 'albert-heijn', 'AH Volkoren brood 800 g', 199, { gtinNo: 32 }),
  own('lidl-volkoren-brood', 'brood', 'lidl', 'Volkorenbrood 800 g', 149, { brand: 'Lidl Bakkerij', gtinNo: 33 }),
  own('jumbo-volkoren-brood', 'brood', 'jumbo', 'Jumbo Volkoren Brood 800g', 189, { gtinNo: 34 }),
  // ── Eieren ─────────────────────────────────────────────────────────────
  own('boni-scharreleieren-12', 'eieren', 'colruyt', 'Boni scharreleieren 12 stuks', 329, { gtinNo: 40 }),
  own('delhaize-eieren-12', 'eieren', 'delhaize', 'Delhaize Oeufs plein air / Eieren vrije uitloop 12 stuks', 349, {
    gtinNo: 41,
  }),
  own('ah-scharreleieren-12', 'eieren', 'albert-heijn', 'AH Scharreleieren 12 stuks', 369, { gtinNo: 42 }),
  own('lidl-scharreleieren-10', 'eieren', 'lidl', 'Scharreleieren 10 stuks', 259, { brand: 'Lidl', gtinNo: 43 }),
  own('jumbo-scharreleieren-12', 'eieren', 'jumbo', 'Jumbo Scharreleieren 12 stuks', 339, { gtinNo: 44 }),
  // ── Vlees ──────────────────────────────────────────────────────────────
  own('colruyt-kipfilet-500', 'vlees', 'colruyt', 'Boni kipfilet 500g', 599, { gtinNo: 50 }),
  own('delhaize-kipfilet-450', 'vlees', 'delhaize', 'Delhaize Filet de poulet / Kipfilet 450 g', 549, { gtinNo: 51 }),
  own('ah-kipfilet-500', 'vlees', 'albert-heijn', 'AH Kipfilet 500 g', 629, { gtinNo: 52 }),
  own('lidl-kipfilet-600', 'vlees', 'lidl', 'Kipfilet 600 g', 599, { brand: 'Lidl', gtinNo: 53 }),
  own('jumbo-kipfilet-500', 'vlees', 'jumbo', 'Jumbo Kipfilet 500g', 589, { gtinNo: 54 }),
  // ── Groenten & fruit ───────────────────────────────────────────────────
  own('colruyt-bananen-kg', 'fruit', 'colruyt', 'Bananen per kilo', 179, { brand: 'Colruyt' }),
  own('delhaize-bananen-kg', 'fruit', 'delhaize', 'Bananes / Bananen 1 kg', 199, { brand: 'Delhaize' }),
  own('ah-bananen-kg', 'fruit', 'albert-heijn', 'AH Bananen 1 kg', 189),
  own('lidl-bananen-kg', 'fruit', 'lidl', 'Bananen 1kg', 159, { brand: 'Lidl' }),
  own('jumbo-chiquita-5', 'fruit', 'jumbo', 'Chiquita bananen 5 stuks', 229),
  // ── Verzorging ─────────────────────────────────────────────────────────
  same('colgate-total-75', 'verzorging', 60, {
    colruyt: ['Colgate Total Original tandpasta 75ml', 349],
    delhaize: ['Colgate Total Original dentifrice / tandpasta 75 ml', 399],
    'albert-heijn': ['Colgate Total Original tandpasta 75 ml', 389],
    jumbo: ['Colgate Total Original Tandpasta 75ml', 379],
  }),
  same('zendium-classic-75', 'verzorging', 61, {
    colruyt: ['Zendium Classic tandpasta 75ml', 299],
    'albert-heijn': ['Zendium Classic tandpasta 75 ml', 319],
    jumbo: ['Zendium Classic Tandpasta 75ml', 309],
    delhaize: ['Zendium Classic dentifrice 75 ml', 329],
  }),
  // ── Baby ───────────────────────────────────────────────────────────────
  same('pampers-baby-dry-4-44', 'baby', 70, {
    colruyt: ['Pampers Baby-Dry luiers maat 4 44 stuks', 1549],
    delhaize: ['Pampers Baby-Dry couches / luiers taille 4 44 pièces', 1699],
    'albert-heijn': ['Pampers Baby-Dry luiers maat 4 44 stuks', 1749],
    jumbo: ['Pampers Baby Dry Luiers Maat 4 44 stuks', 1649],
  }),
  // ── Voorraadkast ───────────────────────────────────────────────────────
  same('lotus-speculoos-250', 'voorraad', 80, {
    colruyt: ['Lotus Speculoos 250g', 169],
    delhaize: ['Lotus Biscoff Speculoos 250 g', 189],
    'albert-heijn': ['Lotus Speculoos koekjes 250 g', 199],
    lidl: ['Lotus Speculoos 250 g', 175],
    jumbo: ['Lotus Speculoos 250g', 185],
  }),
  same(
    'barilla-spaghetti-5-500',
    'voorraad',
    81,
    {
      colruyt: ['Barilla Spaghetti n.5 500g', 149],
      delhaize: ['Barilla Spaghetti n°5 500 g', 179],
      'albert-heijn': ['Barilla Spaghetti no.5 500 g', 169],
      jumbo: ['Barilla Spaghetti N.5 500g', 165],
      lidl: ['Barilla Spaghetti n.5 500 g', 155],
    },
    'Barilla',
  ),
  same(
    'douwe-egberts-aroma-rood-500',
    'voorraad',
    82,
    {
      'albert-heijn': ['Douwe Egberts Aroma Rood filterkoffie 500 g', 699],
      jumbo: ['Douwe Egberts Aroma Rood Filterkoffie 500g', 689],
      plus: ['Douwe Egberts Aroma rood filterkoffie 500 gram', 679],
      dirk: ['Douwe Egberts Aroma Rood 500 g', 649],
      delhaize: ['Douwe Egberts Aroma Rood café moulu 500 g', 749],
    },
    'Douwe Egberts',
  ),
  // ── Diepvries ──────────────────────────────────────────────────────────
  same(
    'iglo-vissticks-10',
    'diepvries',
    90,
    {
      colruyt: ['Iglo 10 vissticks 280g', 399],
      delhaize: ['Iglo Fish sticks / vissticks 10 stuks 280 g', 449],
      'albert-heijn': ['Iglo Vissticks 10 stuks 280 g', 429],
      jumbo: ['Iglo Vissticks 280g', 419],
    },
    'Iglo',
  ),
];

export interface DevPromotion {
  externalId: string;
  retailer: DevRetailer;
  productKeys: string[];
  params: PromotionParams;
  label: string;
  /** Days relative to the seed's "now". */
  startsInDays: number;
  endsInDays: number;
  loyaltyProgram?: string;
  minQuantity?: number;
}

export const DEV_PROMOTIONS: DevPromotion[] = [
  {
    externalId: 'ah-cola-2voor4',
    retailer: 'albert-heijn',
    productKeys: ['coca-cola-zero-15', 'coca-cola-original-15'],
    params: { mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 2, totalCents: 400 },
    label: '2 voor €4',
    startsInDays: -2,
    endsInDays: 5,
  },
  {
    externalId: 'delhaize-pampers-2e-halve',
    retailer: 'delhaize',
    productKeys: ['pampers-baby-dry-4-44'],
    params: { mechanic: 'NTH_ITEM_PERCENT_OFF', nth: 2, percent: 50 },
    label: '2e aan halve prijs',
    startsInDays: -4,
    endsInDays: 3,
  },
  {
    externalId: 'colruyt-lotus-1plus1',
    retailer: 'colruyt',
    productKeys: ['lotus-speculoos-250'],
    params: { mechanic: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 },
    label: '1+1 gratis',
    startsInDays: -1,
    endsInDays: 1,
  },
  {
    externalId: 'jumbo-campina-3voor4',
    retailer: 'jumbo',
    productKeys: ['campina-halfvolle-melk-1l'],
    params: { mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 3, totalCents: 400 },
    label: '3 voor €4',
    startsInDays: -3,
    endsInDays: 4,
  },
  {
    externalId: 'ah-kipfilet-bonus',
    retailer: 'albert-heijn',
    productKeys: ['ah-kipfilet-500'],
    params: { mechanic: 'PERCENT_OFF', percent: 25 },
    label: 'Bonus -25%',
    startsInDays: -1,
    endsInDays: 6,
    loyaltyProgram: 'bonuskaart',
  },
  {
    externalId: 'delhaize-colgate-superplus',
    retailer: 'delhaize',
    productKeys: ['colgate-total-75'],
    params: { mechanic: 'PERCENT_OFF', percent: 20 },
    label: 'SuperPlus -20%',
    startsInDays: -5,
    endsInDays: 9,
    loyaltyProgram: 'superplus',
  },
  {
    externalId: 'colruyt-eieren-50ct',
    retailer: 'colruyt',
    productKeys: ['boni-scharreleieren-12'],
    params: { mechanic: 'AMOUNT_OFF', amountCents: 50 },
    label: '€0,50 korting',
    startsInDays: -2,
    endsInDays: 12,
  },
  {
    externalId: 'lidl-spaghetti-price-cut',
    retailer: 'lidl',
    productKeys: ['barilla-spaghetti-5-500'],
    params: { mechanic: 'PRICE_CUT', promoPriceCents: 119 },
    label: 'Nu €1,19',
    startsInDays: -1,
    endsInDays: 5,
  },
  {
    externalId: 'jumbo-iglo-2plus1',
    retailer: 'jumbo',
    productKeys: ['iglo-vissticks-10'],
    params: { mechanic: 'BUY_X_GET_Y_FREE', buy: 2, free: 1 },
    label: '2+1 gratis',
    startsInDays: -6,
    endsInDays: 1,
  },
  {
    externalId: 'colruyt-pampers-next-week',
    retailer: 'colruyt',
    productKeys: ['pampers-baby-dry-4-44'],
    params: { mechanic: 'PERCENT_OFF', percent: 30 },
    label: '-30% (volgende week)',
    startsInDays: 7,
    endsInDays: 14,
  },
];

export const DEV_CATEGORIES = [
  { externalId: 'zuivel', name: 'Zuivel' },
  { externalId: 'frisdrank', name: 'Frisdrank' },
  { externalId: 'brood', name: 'Brood' },
  { externalId: 'eieren', name: 'Eieren' },
  { externalId: 'vlees', name: 'Vlees & vis' },
  { externalId: 'fruit', name: 'Groenten & fruit' },
  { externalId: 'verzorging', name: 'Verzorging' },
  { externalId: 'baby', name: 'Baby' },
  { externalId: 'voorraad', name: 'Voorraadkast' },
  { externalId: 'diepvries', name: 'Diepvries' },
];
