/**
 * DEMOGEGEVENS voor de supermarktvergelijker.
 *
 * Alles hier is verzonnen. Productnamen en merken zijn realistisch zodat
 * zoeken, matchen en vergelijken écht te testen zijn, maar de prijzen zijn
 * géén winkelprijzen. Elke aanbieding die hieruit komt draagt
 * `source.kind = 'DEMO'`, en de app toont dat bij elke prijs.
 *
 * De generator is deterministisch: dezelfde invoer geeft altijd dezelfde
 * prijzen, zodat imports idempotent zijn en tests stabiel.
 *
 * Zie `docs/COMPARE.md` voor wat nodig is om een keten op echte data te zetten.
 */
import type { OfferChannel, PackageUnit, PromotionRuleInput, PromotionType } from '@superette/contracts';
import { applyPercentageDiscount } from '@superette/pricing';
import { completeEan } from '../../catalog/ean';
import type {
  AdapterContext,
  AdapterSnapshot,
  NormalizedLocation,
  NormalizedOffer,
  NormalizedStoreProduct,
} from '../adapters/supermarket-adapter';

export const DEMO_SOURCE_LABEL = 'Demogegevens — geen echte winkelprijzen';

interface DemoProduct {
  readonly sku: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly quantity: number;
  readonly unit: PackageUnit;
  readonly packCount?: number;
  /** Richtprijs in centen; per keten vermenigvuldigd met een factor. */
  readonly priceCents: number;
  readonly depositCents?: number;
}

/** A-merken en merkloze versproducten, bij (bijna) elke keten te vinden. */
const NATIONAL_PRODUCTS: readonly DemoProduct[] = [
  { sku: 'melk-inex-1l', name: 'Halfvolle melk', brand: 'Inex', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 109 },
  { sku: 'melk-campina-1l', name: 'Halfvolle melk', brand: 'Campina', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 119 },
  { sku: 'cola-zero-1-5l', name: 'Coca-Cola Zero', brand: 'Coca-Cola', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 199 },
  { sku: 'cola-zero-6x33cl', name: 'Coca-Cola Zero', brand: 'Coca-Cola', category: 'dranken', quantity: 33, unit: 'CL', packCount: 6, priceCents: 499 },
  { sku: 'cola-regular-1-5l', name: 'Coca-Cola Regular', brand: 'Coca-Cola', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 199 },
  { sku: 'kipfilet-500g', name: 'Kipfilet', brand: null, category: 'vlees-vis', quantity: 500, unit: 'G', priceCents: 649 },
  { sku: 'olijfolie-bertolli-750ml', name: 'Olijfolie extra vierge', brand: 'Bertolli', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 749 },
  { sku: 'olijfolie-carapelli-1l', name: 'Olijfolie extra vierge', brand: 'Carapelli', category: 'kruidenierswaren', quantity: 1, unit: 'L', priceCents: 999 },
  { sku: 'toiletpapier-page-8', name: 'Toiletpapier Original 3-laags', brand: 'Page', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 599 },
  { sku: 'yoghurt-lactosevrij-500g', name: 'Lactosevrije yoghurt natuur', brand: 'Inex', category: 'zuivel', quantity: 500, unit: 'G', priceCents: 189 },
  { sku: 'koffie-de-aroma-rood-500g', name: 'Gemalen koffie Aroma Rood', brand: 'Douwe Egberts', category: 'koffie-thee', quantity: 500, unit: 'G', priceCents: 749 },
  { sku: 'koffie-lavazza-rossa-250g', name: 'Gemalen koffie Qualità Rossa', brand: 'Lavazza', category: 'koffie-thee', quantity: 250, unit: 'G', priceCents: 449 },
  { sku: 'pampers-baby-dry-4-90', name: 'Baby-Dry luiers maat 4', brand: 'Pampers', category: 'baby', quantity: 90, unit: 'PIECE', priceCents: 2799 },
  { sku: 'nutella-750g', name: 'Nutella hazelnootpasta', brand: 'Ferrero', category: 'brood-ontbijt', quantity: 750, unit: 'G', priceCents: 599 },
  { sku: 'spaghetti-barilla-500g', name: 'Spaghetti n°5', brand: 'Barilla', category: 'kruidenierswaren', quantity: 500, unit: 'G', priceCents: 169 },
  { sku: 'suiker-tiense-1kg', name: 'Kristalsuiker', brand: 'Tiense Suiker', category: 'kruidenierswaren', quantity: 1, unit: 'KG', priceCents: 149 },
  { sku: 'boter-carlsbourg-250g', name: 'Boter ongezouten', brand: 'Carlsbourg', category: 'zuivel', quantity: 250, unit: 'G', priceCents: 299 },
  { sku: 'eieren-vrije-uitloop-12', name: 'Eieren vrije uitloop', brand: null, category: 'zuivel', quantity: 12, unit: 'PIECE', priceCents: 349 },
  { sku: 'bananen-1kg', name: 'Bananen', brand: null, category: 'groenten-fruit', quantity: 1, unit: 'KG', priceCents: 179 },
  { sku: 'jupiler-6x33cl', name: 'Jupiler pils blik', brand: 'Jupiler', category: 'dranken', quantity: 33, unit: 'CL', packCount: 6, priceCents: 549 },
  { sku: 'jupiler-bak-24x25cl', name: 'Jupiler pils bak', brand: 'Jupiler', category: 'dranken', quantity: 25, unit: 'CL', packCount: 24, priceCents: 1499, depositCents: 450 },
  { sku: 'spa-reine-6x1-5l', name: 'Spa Reine plat water', brand: 'Spa', category: 'dranken', quantity: 1.5, unit: 'L', packCount: 6, priceCents: 429 },
  { sku: 'gouda-milner-350g', name: 'Gouda jong gesneden', brand: 'Milner', category: 'zuivel', quantity: 350, unit: 'G', priceCents: 399 },
  { sku: 'pizza-oetker-margherita-355g', name: 'Ristorante pizza Margherita', brand: 'Dr. Oetker', category: 'diepvries', quantity: 355, unit: 'G', priceCents: 349 },
  { sku: 'tandpasta-colgate-75ml', name: 'Tandpasta Total Original', brand: 'Colgate', category: 'huishouden', quantity: 75, unit: 'ML', priceCents: 249 },
  { sku: 'wasmiddel-ariel-1-1l', name: 'Vloeibaar wasmiddel Original', brand: 'Ariel', category: 'huishouden', quantity: 1.1, unit: 'L', priceCents: 899 },
  { sku: 'appelsap-looza-1l', name: 'Appelsap', brand: 'Looza', category: 'dranken', quantity: 1, unit: 'L', priceCents: 229 },
];

interface StoreBrandProduct extends DemoProduct {
  readonly chain: string;
}

/** Huismerken per keten. Richtprijs is hier al de ketenprijs. */
const STORE_BRAND_PRODUCTS: readonly StoreBrandProduct[] = [
  // Colruyt
  { chain: 'colruyt', sku: 'boni-melk-1l', name: 'Halfvolle melk', brand: 'Boni', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 89 },
  { chain: 'colruyt', sku: 'everyday-cola-zero-1-5l', name: 'Cola Zero', brand: 'Everyday', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 69 },
  { chain: 'colruyt', sku: 'boni-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'Boni', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 549 },
  { chain: 'colruyt', sku: 'everyday-toiletpapier-8', name: 'Toiletpapier 2-laags', brand: 'Everyday', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 299 },
  { chain: 'colruyt', sku: 'boni-koffie-500g', name: 'Gemalen koffie dessert', brand: 'Boni', category: 'koffie-thee', quantity: 500, unit: 'G', priceCents: 499 },
  { chain: 'colruyt', sku: 'boni-spaghetti-500g', name: 'Spaghetti', brand: 'Boni', category: 'kruidenierswaren', quantity: 500, unit: 'G', priceCents: 89 },
  // Delhaize
  { chain: 'delhaize', sku: '365-melk-1l', name: 'Halfvolle melk', brand: '365', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 95 },
  { chain: 'delhaize', sku: '365-cola-zero-1-5l', name: 'Cola Zero', brand: '365', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 79 },
  { chain: 'delhaize', sku: 'delhaize-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'Delhaize', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 599 },
  { chain: 'delhaize', sku: '365-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: '365', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 329 },
  { chain: 'delhaize', sku: 'delhaize-koffie-500g', name: 'Gemalen koffie dessert', brand: 'Delhaize', category: 'koffie-thee', quantity: 500, unit: 'G', priceCents: 529 },
  // Lidl
  { chain: 'lidl', sku: 'milbona-melk-1l', name: 'Halfvolle melk', brand: 'Milbona', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 85 },
  { chain: 'lidl', sku: 'freeway-cola-zero-1-5l', name: 'Cola Zero', brand: 'Freeway', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 59 },
  { chain: 'lidl', sku: 'primadonna-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'Primadonna', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 499 },
  { chain: 'lidl', sku: 'floralys-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: 'Floralys', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 279 },
  { chain: 'lidl', sku: 'bellarom-koffie-500g', name: 'Gemalen koffie dessert', brand: 'Bellarom', category: 'koffie-thee', quantity: 500, unit: 'G', priceCents: 429 },
  { chain: 'lidl', sku: 'combino-spaghetti-500g', name: 'Spaghetti', brand: 'Combino', category: 'kruidenierswaren', quantity: 500, unit: 'G', priceCents: 79 },
  { chain: 'lidl', sku: 'toujours-luiers-4-60', name: 'Luiers maat 4', brand: 'Toujours', category: 'baby', quantity: 60, unit: 'PIECE', priceCents: 1099 },
  // Albert Heijn
  { chain: 'albert-heijn', sku: 'ah-melk-1l', name: 'Halfvolle melk', brand: 'AH', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 99 },
  { chain: 'albert-heijn', sku: 'ah-cola-zero-1-5l', name: 'Cola Zero', brand: 'AH', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 89 },
  { chain: 'albert-heijn', sku: 'ah-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'AH', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 579 },
  { chain: 'albert-heijn', sku: 'ah-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: 'AH', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 339 },
  { chain: 'albert-heijn', sku: 'ah-koffie-500g', name: 'Gemalen koffie rood', brand: 'AH', category: 'koffie-thee', quantity: 500, unit: 'G', priceCents: 519 },
  // Jumbo
  { chain: 'jumbo', sku: 'jumbo-melk-1l', name: 'Halfvolle melk', brand: 'Jumbo', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 97 },
  { chain: 'jumbo', sku: 'jumbo-cola-zero-1-5l', name: 'Cola Zero', brand: 'Jumbo', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 79 },
  { chain: 'jumbo', sku: 'jumbo-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'Jumbo', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 569 },
  { chain: 'jumbo', sku: 'jumbo-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: 'Jumbo', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 319 },
  // Carrefour
  { chain: 'carrefour', sku: 'carrefour-melk-1l', name: 'Halfvolle melk', brand: 'Carrefour', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 99 },
  { chain: 'carrefour', sku: 'carrefour-classic-cola-zero-1-5l', name: 'Cola Zero', brand: 'Carrefour Classic', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 75 },
  { chain: 'carrefour', sku: 'carrefour-olijfolie-750ml', name: 'Olijfolie extra vierge', brand: 'Carrefour', category: 'kruidenierswaren', quantity: 750, unit: 'ML', priceCents: 589 },
  { chain: 'carrefour', sku: 'carrefour-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: 'Carrefour', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 329 },
  { chain: 'carrefour', sku: 'simpl-spaghetti-500g', name: 'Spaghetti', brand: 'Simpl', category: 'kruidenierswaren', quantity: 500, unit: 'G', priceCents: 69 },
  // SPAR
  { chain: 'spar', sku: 'spar-melk-1l', name: 'Halfvolle melk', brand: 'Spar', category: 'zuivel', quantity: 1, unit: 'L', priceCents: 105 },
  { chain: 'spar', sku: 'spar-cola-zero-1-5l', name: 'Cola Zero', brand: 'Spar', category: 'dranken', quantity: 1.5, unit: 'L', priceCents: 85 },
  { chain: 'spar', sku: 'spar-toiletpapier-8', name: 'Toiletpapier 3-laags', brand: 'Spar', category: 'huishouden', quantity: 8, unit: 'PIECE', priceCents: 349 },
];

interface DemoPromotion {
  readonly type: PromotionType;
  readonly rule: PromotionRuleInput;
  readonly text?: string;
  readonly conditions?: string;
  readonly requiresLoyaltyCard?: boolean;
  readonly isPersonalized?: boolean;
  readonly channel?: OfferChannel;
  /** Alleen in dit filiaal (regionale prijs). */
  readonly locationExternalId?: string;
}

interface DemoChain {
  readonly key: string;
  /** Prijsniveau van de keten ten opzichte van de richtprijs. */
  readonly priceFactor: number;
  /** Producten die deze keten (in de demo) niet voert. Ontbrekende producten moeten zichtbaar blijven. */
  readonly missing: readonly string[];
  readonly locations: readonly NormalizedLocation[];
  readonly promotions: Readonly<Record<string, DemoPromotion>>;
}

const DEMO_CHAINS: Readonly<Record<string, DemoChain>> = Object.freeze({
  delhaize: {
    key: 'delhaize',
    priceFactor: 1.06,
    missing: ['jupiler-bak-24x25cl', 'toujours-luiers-4-60'],
    locations: [
      { externalId: 'dlz-antwerpen-zuid', name: 'AD Delhaize Antwerpen Zuid', address: 'Volkstraat 10', postalCode: '2000', city: 'Antwerpen', latitude: 51.2103, longitude: 4.3961 },
      { externalId: 'dlz-gent-zuid', name: 'Delhaize Gent Zuid', address: 'Woodrow Wilsonplein 4', postalCode: '9000', city: 'Gent', latitude: 51.0486, longitude: 3.7319 },
    ],
    promotions: {
      'cola-zero-1-5l': { type: 'BUY_X_GET_Y', rule: { kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 }, text: '1+1 gratis' },
      'nutella-750g': { type: 'PERCENTAGE', rule: { kind: 'PERCENTAGE', percent: 20 }, text: '-20%' },
      'pampers-baby-dry-4-90': {
        type: 'LOYALTY_CARD',
        rule: { kind: 'PERCENTAGE', percent: 25 },
        text: '-25% met SuperPlus',
        requiresLoyaltyCard: true,
        conditions: 'Alleen met SuperPlus-kaart',
      },
    },
  },
  lidl: {
    key: 'lidl',
    priceFactor: 0.9,
    missing: ['melk-campina-1l', 'koffie-lavazza-rossa-250g', 'gouda-milner-350g', 'appelsap-looza-1l', 'jupiler-bak-24x25cl'],
    locations: [
      { externalId: 'lidl-antwerpen-kiel', name: 'Lidl Antwerpen Kiel', address: 'Sint-Bernardsesteenweg 200', postalCode: '2020', city: 'Antwerpen', latitude: 51.1935, longitude: 4.3838 },
      { externalId: 'lidl-brussel-anderlecht', name: 'Lidl Anderlecht', address: 'Bergensesteenweg 500', postalCode: '1070', city: 'Anderlecht', latitude: 50.8278, longitude: 4.2957 },
    ],
    promotions: {
      'koffie-de-aroma-rood-500g': { type: 'TEMPORARY', rule: { kind: 'FIXED_PRICE', priceCents: 599 }, text: 'Promoprijs' },
      'bananen-1kg': { type: 'PERCENTAGE', rule: { kind: 'PERCENTAGE', percent: 15 }, text: '-15%' },
    },
  },
  colruyt: {
    key: 'colruyt',
    priceFactor: 0.94,
    missing: ['toujours-luiers-4-60'],
    locations: [
      { externalId: 'colruyt-deurne', name: 'Colruyt Deurne', address: 'Bisschoppenhoflaan 100', postalCode: '2100', city: 'Deurne', latitude: 51.2242, longitude: 4.4546 },
      { externalId: 'colruyt-ledeberg', name: 'Colruyt Ledeberg', address: 'Hundelgemsesteenweg 50', postalCode: '9050', city: 'Ledeberg', latitude: 51.0367, longitude: 3.7466 },
    ],
    promotions: {
      'olijfolie-bertolli-750ml': {
        type: 'PERSONALIZED',
        rule: { kind: 'PERCENTAGE', percent: 10 },
        text: 'Persoonlijke Xtra-korting -10%',
        isPersonalized: true,
        requiresLoyaltyCard: true,
        conditions: 'Persoonlijke aanbieding in de Xtra-app',
      },
    },
  },
  spar: {
    key: 'spar',
    priceFactor: 1.08,
    missing: ['pampers-baby-dry-4-90', 'wasmiddel-ariel-1-1l', 'jupiler-bak-24x25cl', 'koffie-lavazza-rossa-250g'],
    locations: [
      { externalId: 'spar-berchem', name: 'Spar Berchem', address: 'Grote Steenweg 120', postalCode: '2600', city: 'Berchem', latitude: 51.1902, longitude: 4.4296 },
      { externalId: 'spar-leuven', name: 'Spar Leuven', address: 'Tiensestraat 80', postalCode: '3000', city: 'Leuven', latitude: 50.8775, longitude: 4.7044 },
    ],
    promotions: {
      'spaghetti-barilla-500g': { type: 'MULTIBUY', rule: { kind: 'MULTIBUY', quantity: 2, totalCents: 250 }, text: '2 voor €2,50' },
      'boter-carlsbourg-250g': { type: 'VOLUME_DISCOUNT', rule: { kind: 'NTH_AT_DISCOUNT', nth: 2, percent: 50 }, text: '2de aan -50%' },
    },
  },
  'albert-heijn': {
    key: 'albert-heijn',
    priceFactor: 1.0,
    missing: ['jupiler-bak-24x25cl', 'koffie-de-aroma-rood-500g'],
    locations: [
      { externalId: 'ah-antwerpen-centraal', name: 'Albert Heijn Antwerpen Centraal', address: 'Pelikaanstraat 3', postalCode: '2018', city: 'Antwerpen', latitude: 51.2172, longitude: 4.4211 },
      { externalId: 'ah-mechelen', name: 'Albert Heijn Mechelen', address: 'Bruul 40', postalCode: '2800', city: 'Mechelen', latitude: 51.0259, longitude: 4.4776 },
    ],
    promotions: {
      'cola-zero-6x33cl': {
        type: 'LOYALTY_CARD',
        rule: { kind: 'FIXED_PRICE', priceCents: 399 },
        text: 'Bonus',
        requiresLoyaltyCard: true,
        conditions: 'Alleen met AH Bonuskaart',
      },
      'koffie-lavazza-rossa-250g': {
        type: 'VOLUME_DISCOUNT',
        rule: { kind: 'VOLUME_DISCOUNT', minimumQuantity: 3, unitPriceCents: 399 },
        text: 'Vanaf 3 stuks €3,99 per stuk',
      },
    },
  },
  jumbo: {
    key: 'jumbo',
    priceFactor: 0.97,
    missing: ['jupiler-bak-24x25cl', 'olijfolie-carapelli-1l', 'yoghurt-lactosevrij-500g'],
    locations: [
      { externalId: 'jumbo-ekeren', name: 'Jumbo Ekeren', address: 'Kapelsesteenweg 300', postalCode: '2180', city: 'Ekeren', latitude: 51.2795, longitude: 4.4248 },
      { externalId: 'jumbo-hasselt', name: 'Jumbo Hasselt', address: 'Kuringersteenweg 200', postalCode: '3500', city: 'Hasselt', latitude: 50.9361, longitude: 5.3176 },
    ],
    promotions: {
      'pizza-oetker-margherita-355g': { type: 'TEMPORARY', rule: { kind: 'FIXED_PRICE', priceCents: 299 }, text: 'Promoprijs' },
      'spa-reine-6x1-5l': { type: 'PERCENTAGE', rule: { kind: 'PERCENTAGE', percent: 25 }, text: '-25%' },
    },
  },
  carrefour: {
    key: 'carrefour',
    priceFactor: 1.03,
    missing: ['toujours-luiers-4-60', 'melk-inex-1l'],
    locations: [
      { externalId: 'carrefour-market-antwerpen', name: 'Carrefour Market Antwerpen Centrum', address: 'Meir 60', postalCode: '2000', city: 'Antwerpen', latitude: 51.2186, longitude: 4.4079 },
      { externalId: 'carrefour-hyper-brugge', name: 'Carrefour Hyper Brugge', address: 'Sint-Pieterskaai 1', postalCode: '8000', city: 'Brugge', latitude: 51.2231, longitude: 3.2219 },
    ],
    promotions: {
      'pampers-baby-dry-4-90': { type: 'VOLUME_DISCOUNT', rule: { kind: 'NTH_AT_DISCOUNT', nth: 2, percent: 50 }, text: '2de aan -50%' },
      'melk-campina-1l': { type: 'ONLINE_ONLY', rule: { kind: 'PERCENTAGE', percent: 10 }, text: 'Online -10%', channel: 'ONLINE', conditions: 'Alleen in de webshop' },
      'olijfolie-carapelli-1l': {
        type: 'REGIONAL',
        rule: { kind: 'FIXED_PRICE', priceCents: 849 },
        text: 'Lokale promo',
        locationExternalId: 'carrefour-market-antwerpen',
        conditions: 'Alleen in Carrefour Market Antwerpen Centrum',
      },
    },
  },
});

export const DEMO_CHAIN_KEYS: readonly string[] = Object.keys(DEMO_CHAINS);

/** FNV-1a, voor deterministische prijsvariatie per keten en product. */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Ketenprijs: richtprijs × ketenfactor, met een vaste variatie van −3…+3 cent. */
function chainPrice(chainKey: string, product: DemoProduct): number {
  const jitter = (hash32(`${chainKey}:${product.sku}`) % 7) - 3;
  return Math.max(1, Math.round(product.priceCents * (DEMO_CHAINS[chainKey]?.priceFactor ?? 1)) + jitter);
}

/** Demobarcodes met geldig controlecijfer, buiten elk echt GS1-bereik dat wij kennen. */
function demoEan(prefix: '541299' | '541298', index: number): string {
  return completeEan(`${prefix}${String(index).padStart(6, '0')}`);
}

function toStoreProduct(product: DemoProduct, barcode: string, categorySlug: string): NormalizedStoreProduct {
  // Zoals ketens het doen: merk vooraan, tenzij het al in de naam zit ("Coca-Cola Zero").
  const brandPrefix = product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : '';

  return {
    externalId: product.sku,
    name: `${brandPrefix}${product.name} ${formatQuantity(product)}`.trim(),
    brand: product.brand,
    barcode,
    imageUrl: null,
    productUrl: null,
    categorySlug,
    packageQuantity: product.quantity,
    packageUnit: product.unit,
    packCount: product.packCount ?? 1,
    active: true,
  };
}

function formatQuantity(product: DemoProduct): string {
  const unitLabel: Record<PackageUnit, string> = { G: 'g', KG: 'kg', ML: 'ml', CL: 'cl', L: 'l', PIECE: 'stuks' };
  const quantity = String(product.quantity).replace('.', ',');
  const single = `${quantity} ${unitLabel[product.unit]}`;
  return product.packCount && product.packCount > 1 ? `${product.packCount} x ${single}` : single;
}

function isUnconditional(rule: PromotionRuleInput): boolean {
  return rule.kind === 'FIXED_PRICE' || rule.kind === 'PERCENTAGE';
}

function unconditionalPrice(regular: number, rule: PromotionRuleInput): number {
  if (rule.kind === 'FIXED_PRICE') return Math.min(rule.priceCents, regular);
  if (rule.kind === 'PERCENTAGE') return applyPercentageDiscount(regular, rule.percent);
  return regular;
}

/**
 * Bouwt de volledige demosnapshot voor één keten.
 *
 * Elk product krijgt één reguliere aanbieding; promoties zitten in diezelfde
 * aanbieding (onvoorwaardelijk: verrekend in `priceCents`, voorwaardelijk: in
 * `promotionRule`). Regionale promoties zijn een extra aanbieding per filiaal.
 */
export function buildDemoSnapshot(chainKey: string, context: Pick<AdapterContext, 'now'>): AdapterSnapshot {
  const chain = DEMO_CHAINS[chainKey];
  if (!chain) {
    throw new Error(`Geen demogegevens voor keten "${chainKey}"`);
  }

  const now = context.now;
  const promoStart = new Date(now.getTime() - 2 * 86_400_000);
  const promoEnd = new Date(now.getTime() + 5 * 86_400_000);

  const products: NormalizedStoreProduct[] = [];
  const offers: NormalizedOffer[] = [];

  const addOffers = (product: DemoProduct, regularCents: number): void => {
    const promotion = chain.promotions[product.sku];

    if (!promotion) {
      offers.push({
        productExternalId: product.sku,
        sourceReference: `${product.sku}:regular`,
        priceCents: regularCents,
        originalPriceCents: null,
        promotionType: 'NONE',
        depositCents: product.depositCents ?? null,
        availability: 'IN_STOCK',
        channel: 'BOTH',
        observedAt: now,
        confidence: 1,
      });
      return;
    }

    const conditional = !isUnconditional(promotion.rule);
    const promoOffer: NormalizedOffer = {
      productExternalId: product.sku,
      locationExternalId: promotion.locationExternalId ?? null,
      sourceReference: `${product.sku}:${promotion.locationExternalId ? `promo-${promotion.locationExternalId}` : 'promo'}`,
      priceCents: conditional ? regularCents : unconditionalPrice(regularCents, promotion.rule),
      originalPriceCents: conditional ? null : regularCents,
      promotionType: promotion.type,
      promotionText: promotion.text ?? null,
      promotionRule: promotion.rule,
      conditions: promotion.conditions ?? null,
      requiresLoyaltyCard: promotion.requiresLoyaltyCard ?? false,
      isPersonalized: promotion.isPersonalized ?? false,
      channel: promotion.channel ?? 'BOTH',
      minimumQuantity:
        promotion.rule.kind === 'MULTIBUY'
          ? promotion.rule.quantity
          : promotion.rule.kind === 'BUY_X_GET_Y_FREE'
            ? promotion.rule.buy + promotion.rule.free
            : promotion.rule.kind === 'VOLUME_DISCOUNT'
              ? promotion.rule.minimumQuantity
              : promotion.rule.kind === 'NTH_AT_DISCOUNT'
                ? promotion.rule.nth
                : 1,
      depositCents: product.depositCents ?? null,
      availability: 'IN_STOCK',
      startsAt: promoStart,
      endsAt: promoEnd,
      observedAt: now,
      confidence: 1,
    };

    // Een regionale, online of persoonlijke promotie vervangt de gewone prijs
    // niet: die blijft voor iedereen elders gelden.
    const keepsRegular =
      promotion.locationExternalId !== undefined || promotion.channel === 'ONLINE' || promotion.isPersonalized === true;

    if (keepsRegular) {
      offers.push({
        productExternalId: product.sku,
        sourceReference: `${product.sku}:regular`,
        priceCents: regularCents,
        originalPriceCents: null,
        promotionType: 'NONE',
        depositCents: product.depositCents ?? null,
        availability: 'IN_STOCK',
        channel: 'BOTH',
        observedAt: now,
        confidence: 1,
      });
    }

    offers.push(promoOffer);
  };

  NATIONAL_PRODUCTS.forEach((product, index) => {
    if (chain.missing.includes(product.sku)) return;
    products.push(toStoreProduct(product, demoEan('541299', index + 1), product.category));
    addOffers(product, chainPrice(chain.key, product));
  });

  STORE_BRAND_PRODUCTS.forEach((product, index) => {
    if (product.chain !== chain.key) return;
    products.push(toStoreProduct(product, demoEan('541298', index + 1), product.category));
    addOffers(product, product.priceCents);
  });

  return {
    chain: { slug: chain.key, name: DEMO_CHAIN_NAMES[chain.key] ?? chain.key },
    source: {
      kind: 'DEMO',
      label: DEMO_SOURCE_LABEL,
      termsReviewed: true,
      notes: 'Verzonnen prijzen voor ontwikkeling en demonstratie. Niet tonen als actuele winkelprijs.',
    },
    observedAt: now,
    locations: chain.locations,
    products,
    offers,
  };
}

const DEMO_CHAIN_NAMES: Readonly<Record<string, string>> = Object.freeze({
  delhaize: 'Delhaize',
  lidl: 'Lidl',
  colruyt: 'Colruyt',
  spar: 'SPAR',
  'albert-heijn': 'Albert Heijn',
  jumbo: 'Jumbo',
  carrefour: 'Carrefour',
});

/** De categorieën die de demogegevens gebruiken. De seed maakt ze aan. */
export const DEMO_CATEGORIES: ReadonlyArray<{ slug: string; nameNl: string; nameFr: string; sortOrder: number }> = [
  { slug: 'zuivel', nameNl: 'Zuivel en eieren', nameFr: 'Produits laitiers et œufs', sortOrder: 1 },
  { slug: 'dranken', nameNl: 'Dranken', nameFr: 'Boissons', sortOrder: 2 },
  { slug: 'vlees-vis', nameNl: 'Vlees en vis', nameFr: 'Viande et poisson', sortOrder: 3 },
  { slug: 'groenten-fruit', nameNl: 'Groenten en fruit', nameFr: 'Fruits et légumes', sortOrder: 4 },
  { slug: 'brood-ontbijt', nameNl: 'Brood en ontbijt', nameFr: 'Pain et petit-déjeuner', sortOrder: 5 },
  { slug: 'koffie-thee', nameNl: 'Koffie en thee', nameFr: 'Café et thé', sortOrder: 6 },
  { slug: 'kruidenierswaren', nameNl: 'Kruidenierswaren', nameFr: 'Épicerie', sortOrder: 7 },
  { slug: 'diepvries', nameNl: 'Diepvries', nameFr: 'Surgelés', sortOrder: 8 },
  { slug: 'huishouden', nameNl: 'Huishouden en verzorging', nameFr: 'Entretien et soins', sortOrder: 9 },
  { slug: 'baby', nameNl: 'Baby', nameFr: 'Bébé', sortOrder: 10 },
];
