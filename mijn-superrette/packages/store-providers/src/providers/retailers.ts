import { UnsupportedStoreProvider } from '../base.js';

/**
 * Retailer providers. Research date: 2026-09-23 (see docs/STORE_PROVIDERS.md
 * and docs/research/RETAILER_DATA_RESEARCH.md for sources).
 *
 * None of these retailers publishes an official public API for products,
 * prices or promotions. Community "APIs" are reverse-engineered mobile/web
 * endpoints or scrapers, which the retailers' terms prohibit — they must not
 * be used. Each provider is therefore UNSUPPORTED until a licensed data
 * agreement or an approved affiliate feed exists; at that point the
 * PartnerFeedProvider (or a dedicated implementation) replaces it.
 */

const NO_PUBLIC_API =
  'No official public product/price API exists. Reverse-engineered endpoints and scraping are not permitted.';

export class ColruytProvider extends UnsupportedStoreProvider {
  constructor() {
    super({
      key: 'colruyt',
      displayName: 'Colruyt',
      retailerSlugs: ['colruyt', 'okay'],
      reason: `${NO_PUBLIC_API} Colruyt's app/site terms prohibit reproducing content or storing it in a database. Path to support: request a data licence from Colruyt Group.`,
      documentation: 'docs/STORE_PROVIDERS.md#colruyt',
    });
  }
}

export class DelhaizeProvider extends UnsupportedStoreProvider {
  constructor() {
    super({
      key: 'delhaize',
      displayName: 'Delhaize',
      retailerSlugs: ['delhaize'],
      reason: `${NO_PUBLIC_API} Delhaize's terms only allow reproduction for personal use. No affiliate product feed was found. Path to support: data licence from Delhaize (Ahold Delhaize).`,
      documentation: 'docs/STORE_PROVIDERS.md#delhaize',
    });
  }
}

export class CarrefourProvider extends UnsupportedStoreProvider {
  constructor() {
    super({
      key: 'carrefour',
      displayName: 'Carrefour Belgium',
      retailerSlugs: ['carrefour'],
      reason: `${NO_PUBLIC_API} No Belgian affiliate/product feed found (Awin/Tradedoubler programmes found are for France). Path to support: data licence from Carrefour Belgium.`,
      documentation: 'docs/STORE_PROVIDERS.md#carrefour',
    });
  }
}

export class AlbertHeijnProvider extends UnsupportedStoreProvider {
  constructor() {
    super({
      key: 'albert-heijn',
      displayName: 'Albert Heijn',
      retailerSlugs: ['albert-heijn'],
      reason: `${NO_PUBLIC_API} AH's terms forbid reproducing site information except for personal use and forbid reverse engineering the AH app. An affiliate programme (Partnerize) offers a product feed and weekly bonus feed; usable only after written approval for comparison use — then configure a PartnerFeedProvider.`,
      documentation: 'docs/STORE_PROVIDERS.md#albert-heijn',
    });
  }
}

export class JumboProvider extends UnsupportedStoreProvider {
  constructor() {
    super({
      key: 'jumbo',
      displayName: 'Jumbo',
      retailerSlugs: ['jumbo'],
      reason: `${NO_PUBLIC_API} Jumbo's terms explicitly forbid scraping/spidering and systematic reuse of content. An affiliate programme exists (TradeTracker); a product feed was not verified. Path to support: written feed approval or data licence.`,
      documentation: 'docs/STORE_PROVIDERS.md#jumbo',
    });
  }
}

interface SimpleRetailer {
  key: string;
  displayName: string;
  retailerSlugs: string[];
  note: string;
}

const OTHER_RETAILERS: SimpleRetailer[] = [
  {
    key: 'lidl',
    displayName: 'Lidl',
    retailerSlugs: ['lidl'],
    note: 'Terms require prior written permission; bot protection is in place. The Lidl-shop affiliate datafeed covers non-food only.',
  },
  { key: 'aldi', displayName: 'ALDI', retailerSlugs: ['aldi'], note: 'No API or feed found.' },
  { key: 'intermarche', displayName: 'Intermarché', retailerSlugs: ['intermarche'], note: 'No API or feed found.' },
  {
    key: 'plus',
    displayName: 'PLUS',
    retailerSlugs: ['plus'],
    note: 'Awin affiliate programme exists; a product feed is not confirmed.',
  },
  { key: 'dirk', displayName: 'Dirk', retailerSlugs: ['dirk'], note: 'No API or feed found.' },
  { key: 'spar', displayName: 'SPAR', retailerSlugs: ['spar'], note: 'No API or feed found.' },
  {
    key: 'picnic',
    displayName: 'Picnic',
    retailerSlugs: ['picnic'],
    note: 'Terms explicitly forbid scraping/spidering.',
  },
  { key: 'dekamarkt', displayName: 'DekaMarkt', retailerSlugs: ['dekamarkt'], note: 'No API or feed found.' },
  { key: 'vomar', displayName: 'Vomar', retailerSlugs: ['vomar'], note: 'No API or feed found.' },
  { key: 'hoogvliet', displayName: 'Hoogvliet', retailerSlugs: ['hoogvliet'], note: 'No API or feed found.' },
  {
    key: 'ekoplaza',
    displayName: 'Ekoplaza',
    retailerSlugs: ['ekoplaza'],
    note: 'No API or affiliate programme found.',
  },
  {
    key: 'kruidvat',
    displayName: 'Kruidvat',
    retailerSlugs: ['kruidvat'],
    note: 'Belgian affiliate programme is closed; NL feed not verified.',
  },
  { key: 'etos', displayName: 'Etos', retailerSlugs: ['etos'], note: 'No independent affiliate programme verified.' },
];

export function otherRetailerProviders(): UnsupportedStoreProvider[] {
  return OTHER_RETAILERS.map(
    (r) =>
      new UnsupportedStoreProvider({
        key: r.key,
        displayName: r.displayName,
        retailerSlugs: r.retailerSlugs,
        reason: `${NO_PUBLIC_API} ${r.note}`,
        documentation: `docs/STORE_PROVIDERS.md#${r.key}`,
      }),
  );
}
