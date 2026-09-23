import type { EntitlementKey, RetailerType } from '@superrette/domain';
import type { Database } from '../client.js';
import {
  categories,
  countries,
  planEntitlements,
  plans,
  retailerCountries,
  retailers,
  type LocalizedText,
} from '../schema/index.js';

/**
 * Reference data: countries, retailers, categories and plans. This is
 * configuration, not price data, and is safe for every environment.
 * Retailer names are used nominatively to identify stores; no logos are stored.
 */

export const COUNTRIES = [
  {
    code: 'BE',
    name: { nl: 'België', fr: 'Belgique', en: 'Belgium' },
    currency: 'EUR',
    languages: ['nl', 'fr', 'en'],
    defaultLocale: 'nl',
    regions: [
      { code: 'VLG', name: 'Vlaanderen' },
      { code: 'WAL', name: 'Wallonie' },
      { code: 'BRU', name: 'Brussel / Bruxelles' },
    ],
  },
  {
    code: 'NL',
    name: { nl: 'Nederland', fr: 'Pays-Bas', en: 'Netherlands' },
    currency: 'EUR',
    languages: ['nl', 'en'],
    defaultLocale: 'nl',
    regions: ['DR', 'FL', 'FR', 'GE', 'GR', 'LI', 'NB', 'NH', 'OV', 'UT', 'ZE', 'ZH'].map((code) => ({
      code,
      name: code,
    })),
  },
] as const;

export interface RetailerSeed {
  slug: string;
  name: string;
  type: RetailerType;
  countries: ('BE' | 'NL')[];
  brandColor: string;
  loyaltyProgram?: string;
  loyaltyProgramName?: string;
  websiteUrl: string;
}

export const RETAILERS: RetailerSeed[] = [
  {
    slug: 'colruyt',
    name: 'Colruyt',
    type: 'SUPERMARKET',
    countries: ['BE'],
    brandColor: '#E4572E',
    loyaltyProgram: 'xtra',
    loyaltyProgramName: 'Xtra',
    websiteUrl: 'https://www.colruyt.be',
  },
  {
    slug: 'delhaize',
    name: 'Delhaize',
    type: 'SUPERMARKET',
    countries: ['BE'],
    brandColor: '#B5121B',
    loyaltyProgram: 'superplus',
    loyaltyProgramName: 'SuperPlus',
    websiteUrl: 'https://www.delhaize.be',
  },
  {
    slug: 'carrefour',
    name: 'Carrefour',
    type: 'SUPERMARKET',
    countries: ['BE'],
    brandColor: '#1E4FA1',
    loyaltyProgram: 'bonus-card',
    loyaltyProgramName: 'Bonus Card',
    websiteUrl: 'https://www.carrefour.be',
  },
  {
    slug: 'albert-heijn',
    name: 'Albert Heijn',
    type: 'SUPERMARKET',
    countries: ['BE', 'NL'],
    brandColor: '#0A7EC2',
    loyaltyProgram: 'bonuskaart',
    loyaltyProgramName: 'Bonuskaart',
    websiteUrl: 'https://www.ah.nl',
  },
  {
    slug: 'lidl',
    name: 'Lidl',
    type: 'DISCOUNTER',
    countries: ['BE', 'NL'],
    brandColor: '#1F4E9C',
    loyaltyProgram: 'lidl-plus',
    loyaltyProgramName: 'Lidl Plus',
    websiteUrl: 'https://www.lidl.be',
  },
  {
    slug: 'aldi',
    name: 'ALDI',
    type: 'DISCOUNTER',
    countries: ['BE', 'NL'],
    brandColor: '#1B3F8B',
    websiteUrl: 'https://www.aldi.be',
  },
  {
    slug: 'intermarche',
    name: 'Intermarché',
    type: 'SUPERMARKET',
    countries: ['BE'],
    brandColor: '#D52B1E',
    websiteUrl: 'https://www.intermarche.be',
  },
  {
    slug: 'okay',
    name: 'Okay',
    type: 'CONVENIENCE',
    countries: ['BE'],
    brandColor: '#F28C28',
    websiteUrl: 'https://www.okay.be',
  },
  {
    slug: 'jumbo',
    name: 'Jumbo',
    type: 'SUPERMARKET',
    countries: ['BE', 'NL'],
    brandColor: '#E0A800',
    loyaltyProgram: 'jumbo-extras',
    loyaltyProgramName: "Jumbo Extra's",
    websiteUrl: 'https://www.jumbo.com',
  },
  {
    slug: 'plus',
    name: 'PLUS',
    type: 'SUPERMARKET',
    countries: ['NL'],
    brandColor: '#4E8B2F',
    websiteUrl: 'https://www.plus.nl',
  },
  {
    slug: 'dirk',
    name: 'Dirk',
    type: 'DISCOUNTER',
    countries: ['NL'],
    brandColor: '#C8102E',
    websiteUrl: 'https://www.dirk.nl',
  },
  {
    slug: 'spar',
    name: 'SPAR',
    type: 'CONVENIENCE',
    countries: ['NL'],
    brandColor: '#1C7C3A',
    websiteUrl: 'https://www.spar.nl',
  },
  {
    slug: 'picnic',
    name: 'Picnic',
    type: 'ONLINE_GROCER',
    countries: ['NL'],
    brandColor: '#D6202A',
    websiteUrl: 'https://picnic.app',
  },
  {
    slug: 'dekamarkt',
    name: 'DekaMarkt',
    type: 'SUPERMARKET',
    countries: ['NL'],
    brandColor: '#D4151C',
    websiteUrl: 'https://www.dekamarkt.nl',
  },
  {
    slug: 'vomar',
    name: 'Vomar',
    type: 'SUPERMARKET',
    countries: ['NL'],
    brandColor: '#E30613',
    websiteUrl: 'https://www.vomar.nl',
  },
  {
    slug: 'hoogvliet',
    name: 'Hoogvliet',
    type: 'SUPERMARKET',
    countries: ['NL'],
    brandColor: '#0055A5',
    websiteUrl: 'https://www.hoogvliet.com',
  },
  {
    slug: 'ekoplaza',
    name: 'Ekoplaza',
    type: 'ORGANIC',
    countries: ['NL'],
    brandColor: '#6A9C2F',
    websiteUrl: 'https://www.ekoplaza.nl',
  },
  {
    slug: 'kruidvat',
    name: 'Kruidvat',
    type: 'DRUGSTORE',
    countries: ['BE', 'NL'],
    brandColor: '#D40F7D',
    websiteUrl: 'https://www.kruidvat.nl',
  },
  {
    slug: 'etos',
    name: 'Etos',
    type: 'DRUGSTORE',
    countries: ['NL'],
    brandColor: '#0090D0',
    websiteUrl: 'https://www.etos.nl',
  },
];

export const CATEGORIES: { slug: string; name: LocalizedText; icon: string }[] = [
  { slug: 'zuivel', name: { nl: 'Zuivel', fr: 'Produits laitiers', en: 'Dairy' }, icon: 'milk' },
  { slug: 'frisdrank', name: { nl: 'Frisdrank', fr: 'Boissons rafraîchissantes', en: 'Soft drinks' }, icon: 'bottle' },
  { slug: 'brood', name: { nl: 'Brood', fr: 'Pain', en: 'Bread' }, icon: 'bread' },
  { slug: 'eieren', name: { nl: 'Eieren', fr: 'Œufs', en: 'Eggs' }, icon: 'egg' },
  { slug: 'vlees', name: { nl: 'Vlees & vis', fr: 'Viande & poisson', en: 'Meat & fish' }, icon: 'meat' },
  { slug: 'fruit', name: { nl: 'Groenten & fruit', fr: 'Fruits & légumes', en: 'Fruit & vegetables' }, icon: 'apple' },
  { slug: 'verzorging', name: { nl: 'Verzorging', fr: 'Soins', en: 'Personal care' }, icon: 'care' },
  { slug: 'baby', name: { nl: 'Baby', fr: 'Bébé', en: 'Baby' }, icon: 'baby' },
  { slug: 'voorraad', name: { nl: 'Voorraadkast', fr: 'Épicerie', en: 'Pantry' }, icon: 'jar' },
  { slug: 'diepvries', name: { nl: 'Diepvries', fr: 'Surgelés', en: 'Frozen' }, icon: 'snow' },
];

/** Default plan configuration. Editable in the database without a release. */
export const PLAN_CONFIG: {
  key: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  grants: [EntitlementKey, boolean, number | null][];
}[] = [
  {
    key: 'free',
    name: 'Mijn Superrette Free',
    isDefault: true,
    sortOrder: 0,
    grants: [
      ['search', true, null],
      ['basic_comparison', true, null],
      ['shopping_lists', true, 3],
      ['basket_comparison', true, 4],
      ['price_alerts', true, 3],
      ['advanced_basket_comparison', false, 0],
      ['price_history', false, 0],
      ['smart_basket', false, 0],
      ['shared_lists', false, 0],
      ['advanced_filters', false, 0],
    ],
  },
  {
    key: 'plus',
    name: 'Mijn Superrette Plus',
    isDefault: false,
    sortOrder: 1,
    grants: [
      ['search', true, null],
      ['basic_comparison', true, null],
      ['shopping_lists', true, null],
      ['basket_comparison', true, null],
      ['advanced_basket_comparison', true, null],
      ['price_alerts', true, null],
      ['price_history', true, null],
      ['smart_basket', true, null],
      ['shared_lists', true, null],
      ['advanced_filters', true, null],
    ],
  },
];

/** Idempotent: safe to run on every deploy. Never overwrites admin edits to plan limits. */
export async function seedReferenceData(db: Database): Promise<void> {
  for (const c of COUNTRIES) {
    await db
      .insert(countries)
      .values({ ...c, languages: [...c.languages], regions: [...c.regions] })
      .onConflictDoNothing();
  }
  for (const r of RETAILERS) {
    const [row] = await db
      .insert(retailers)
      .values({
        slug: r.slug,
        name: r.name,
        type: r.type,
        providerKey: r.slug,
        brandColor: r.brandColor,
        loyaltyProgram: r.loyaltyProgram ?? null,
        loyaltyProgramName: r.loyaltyProgramName ?? null,
        websiteUrl: r.websiteUrl,
      })
      .onConflictDoUpdate({ target: retailers.slug, set: { name: r.name, updatedAt: new Date() } })
      .returning({ id: retailers.id });
    for (const code of r.countries) {
      await db.insert(retailerCountries).values({ retailerId: row!.id, countryCode: code }).onConflictDoNothing();
    }
  }
  let order = 0;
  for (const c of CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...c, sortOrder: order++ })
      .onConflictDoNothing();
  }
  for (const p of PLAN_CONFIG) {
    await db
      .insert(plans)
      .values({ key: p.key, name: p.name, isDefault: p.isDefault, sortOrder: p.sortOrder })
      .onConflictDoNothing();
    for (const [key, enabled, limitValue] of p.grants) {
      await db
        .insert(planEntitlements)
        .values({ planKey: p.key, entitlementKey: key, enabled, limitValue })
        .onConflictDoNothing();
    }
  }
}
