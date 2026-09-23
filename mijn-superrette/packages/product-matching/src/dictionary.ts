import type { DietaryAttribute } from '@superrette/domain';

/**
 * The normaliser is data-driven. This default dictionary covers the NL/FR/EN
 * vocabulary needed for Belgian and Dutch supermarkets. In production the
 * API extends it with brands and aliases stored in the database, so adding
 * a brand never requires a code change.
 */
export interface BrandEntry {
  slug: string;
  name: string;
  aliases: string[];
  /** Retailer slug when this is a private label (huismerk). */
  privateLabelOf?: string | null;
  /** Canonical product words implied by the brand, e.g. Coca-Cola implies "cola". */
  impliesTokens?: string[];
}

export interface ProductTypeEntry {
  slug: string;
  /** Canonical tokens that must all be present. */
  requires: string[];
  /** Canonical tokens that must not be present. */
  excludes?: string[];
  categorySlug: string;
}

export interface NormalizerDictionary {
  brands: BrandEntry[];
  /** Phrase -> canonical token. Applied longest phrase first. */
  synonyms: Record<string, string>;
  productTypes: ProductTypeEntry[];
  /** Canonical tokens that distinguish variants of the same product line. */
  variantTokens: string[];
  flavourTokens: string[];
  dietary: Record<string, DietaryAttribute>;
  /** Tokens without meaning for matching (packaging, filler words). */
  stopwords: string[];
  /**
   * Dutch compound heads: "volkorenbrood" → "volkoren brood",
   * "scharreleieren" → "scharrel eieren". Only split when the rest is ≥ 3 letters.
   */
  compoundHeads: string[];
}

export const DEFAULT_DICTIONARY: NormalizerDictionary = {
  brands: [
    { slug: 'coca-cola', name: 'Coca-Cola', aliases: ['coca cola', 'coca-cola', 'coke'], impliesTokens: ['cola'] },
    { slug: 'pepsi', name: 'Pepsi', aliases: ['pepsi'], impliesTokens: ['cola'] },
    { slug: 'campina', name: 'Campina', aliases: ['campina'] },
    { slug: 'inza', name: 'Inza', aliases: ['inza'] },
    { slug: 'pampers', name: 'Pampers', aliases: ['pampers'] },
    { slug: 'colgate', name: 'Colgate', aliases: ['colgate'] },
    { slug: 'zendium', name: 'Zendium', aliases: ['zendium'] },
    { slug: 'chiquita', name: 'Chiquita', aliases: ['chiquita'] },
    { slug: 'lotus', name: 'Lotus', aliases: ['lotus'] },
    { slug: 'boni', name: 'Boni', aliases: ['boni', 'boni selection'], privateLabelOf: 'colruyt' },
    { slug: 'everyday', name: 'Everyday', aliases: ['everyday'], privateLabelOf: 'colruyt' },
    { slug: 'ah', name: 'AH', aliases: ['ah', 'albert heijn'], privateLabelOf: 'albert-heijn' },
    { slug: 'jumbo', name: 'Jumbo', aliases: ['jumbo'], privateLabelOf: 'jumbo' },
    { slug: 'delhaize', name: 'Delhaize', aliases: ['delhaize'], privateLabelOf: 'delhaize' },
    { slug: '365', name: '365', aliases: ['365'], privateLabelOf: 'delhaize' },
    { slug: 'carrefour', name: 'Carrefour', aliases: ['carrefour', 'carrefour classic'], privateLabelOf: 'carrefour' },
    { slug: 'milbona', name: 'Milbona', aliases: ['milbona'], privateLabelOf: 'lidl' },
    { slug: 'milsani', name: 'Milsani', aliases: ['milsani'], privateLabelOf: 'aldi' },
    { slug: 'plus', name: 'PLUS', aliases: ['plus'], privateLabelOf: 'plus' },
  ],
  synonyms: {
    'zero sugar': 'zero',
    'zero suiker': 'zero',
    zero: 'zero',
    suikervrij: 'zero',
    'sans sucres': 'zero',
    'sans sucre': 'zero',
    'no sugar': 'zero',
    'sugar free': 'zero',
    halfvolle: 'halfvol',
    halfvol: 'halfvol',
    'demi ecreme': 'halfvol',
    'demi ecremee': 'halfvol',
    'semi skimmed': 'halfvol',
    volle: 'vol',
    entier: 'vol',
    entiere: 'vol',
    whole: 'vol',
    magere: 'mager',
    ecreme: 'mager',
    skimmed: 'mager',
    melk: 'melk',
    lait: 'melk',
    milk: 'melk',
    'filet de poulet': 'kipfilet',
    'blanc de poulet': 'kipfilet',
    'chicken breast': 'kipfilet',
    kippenfilet: 'kipfilet',
    kipfilet: 'kipfilet',
    kipfilets: 'kipfilet',
    bananen: 'banaan',
    banaan: 'banaan',
    bananes: 'banaan',
    banane: 'banaan',
    bananas: 'banaan',
    banana: 'banaan',
    dentifrice: 'tandpasta',
    toothpaste: 'tandpasta',
    tandpasta: 'tandpasta',
    luiers: 'luier',
    luier: 'luier',
    couches: 'luier',
    diapers: 'luier',
    eieren: 'ei',
    oeufs: 'ei',
    eggs: 'ei',
    brood: 'brood',
    pain: 'brood',
    bread: 'brood',
    'coca cola': 'cola',
    'coca-cola': 'cola',
    cola: 'cola',
    biologisch: 'bio',
    biologique: 'bio',
    organic: 'bio',
    bio: 'bio',
    lactosevrij: 'lactosevrij',
    'sans lactose': 'lactosevrij',
    'lactose free': 'lactosevrij',
    glutenvrij: 'glutenvrij',
    'sans gluten': 'glutenvrij',
    'gluten free': 'glutenvrij',
    cafeinevrij: 'cafeinevrij',
    'sans cafeine': 'cafeinevrij',
    'caffeine free': 'cafeinevrij',
    volkoren: 'volkoren',
    complet: 'volkoren',
    wholemeal: 'volkoren',
    wit: 'wit',
    blanc: 'wit',
    white: 'wit',
    scharrel: 'scharrel',
    'plein air': 'vrije-uitloop',
    'vrije uitloop': 'vrije-uitloop',
  },
  productTypes: [
    { slug: 'milk-semi-skimmed', requires: ['melk', 'halfvol'], categorySlug: 'zuivel' },
    { slug: 'milk-whole', requires: ['melk', 'vol'], categorySlug: 'zuivel' },
    { slug: 'milk-skimmed', requires: ['melk', 'mager'], categorySlug: 'zuivel' },
    { slug: 'milk', requires: ['melk'], excludes: ['chocolade', 'choco'], categorySlug: 'zuivel' },
    { slug: 'cola', requires: ['cola'], categorySlug: 'frisdrank' },
    { slug: 'bread-wholemeal', requires: ['brood', 'volkoren'], categorySlug: 'brood' },
    { slug: 'bread-white', requires: ['brood', 'wit'], categorySlug: 'brood' },
    { slug: 'bread', requires: ['brood'], categorySlug: 'brood' },
    { slug: 'eggs', requires: ['ei'], categorySlug: 'eieren' },
    { slug: 'chicken-breast', requires: ['kipfilet'], categorySlug: 'vlees' },
    { slug: 'bananas', requires: ['banaan'], categorySlug: 'fruit' },
    { slug: 'toothpaste', requires: ['tandpasta'], categorySlug: 'verzorging' },
    { slug: 'diapers', requires: ['luier'], categorySlug: 'baby' },
  ],
  variantTokens: [
    'zero',
    'light',
    'cafeinevrij',
    'halfvol',
    'vol',
    'mager',
    'volkoren',
    'wit',
    'scharrel',
    'vrije-uitloop',
  ],
  flavourTokens: [
    'cherry',
    'kers',
    'lime',
    'citroen',
    'lemon',
    'vanille',
    'vanilla',
    'mint',
    'munt',
    'aardbei',
    'fraise',
  ],
  dietary: {
    bio: 'organic',
    lactosevrij: 'lactose_free',
    glutenvrij: 'gluten_free',
    vegan: 'vegan',
    vegetarisch: 'vegetarian',
    vegetarien: 'vegetarian',
    halal: 'halal',
    zero: 'sugar_free',
    light: 'light',
  },
  stopwords: [
    'fles',
    'bouteille',
    'bottle',
    'pet',
    'blik',
    'canette',
    'can',
    'pak',
    'brik',
    'brique',
    'doos',
    'boite',
    'zak',
    'sachet',
    'stuk',
    'stuks',
    'st',
    'pieces',
    'piece',
    'de',
    'het',
    'een',
    'le',
    'la',
    'les',
    'du',
    'des',
    'en',
    'et',
    'and',
    'the',
    'van',
    'met',
    'avec',
    'with',
    'x',
    'pack',
    'multipack',
    'per',
    'maat',
    'taille',
    'size',
    'selection',
    'classic',
    'original',
    'origineel',
  ],
  compoundHeads: [
    'brood',
    'eieren',
    'melk',
    'filet',
    'koffie',
    'yoghurt',
    'kaas',
    'sap',
    'pasta',
    'chips',
    'koek',
    'koekjes',
  ],
};

/** Merge DB-provided entries into a dictionary (later entries win by slug/key). */
export function extendDictionary(
  base: NormalizerDictionary,
  extra: Partial<Pick<NormalizerDictionary, 'brands' | 'synonyms' | 'productTypes'>>,
): NormalizerDictionary {
  const brands = new Map(base.brands.map((b) => [b.slug, b]));
  for (const b of extra.brands ?? []) brands.set(b.slug, b);
  const types = new Map(base.productTypes.map((t) => [t.slug, t]));
  for (const t of extra.productTypes ?? []) types.set(t.slug, t);
  return {
    ...base,
    brands: [...brands.values()],
    synonyms: { ...base.synonyms, ...(extra.synonyms ?? {}) },
    productTypes: [...types.values()],
    compoundHeads: base.compoundHeads,
  };
}
