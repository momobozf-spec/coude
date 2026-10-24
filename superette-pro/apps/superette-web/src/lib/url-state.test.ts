import { describe, expect, it } from 'vitest';
import { activeFilterCount, DEFAULT_FILTERS, parseSearchParams, serializeSearchParams, toSearchQuery } from './url-state';

describe('zoekfilters in de URL', () => {
  it('leest filters uit de URL met veilige standaardwaarden', () => {
    const filters = parseSearchParams(new URLSearchParams('q=melk&winkels=lidl,colruyt,ONGELDIG!&sorteer=DISCOUNT&pagina=2&promoties=1&klantenkaart=NOT_REQUIRED&online=0'));
    expect(filters.q).toBe('melk');
    expect(filters.chains).toEqual(['lidl', 'colruyt']);
    expect(filters.sort).toBe('DISCOUNT');
    expect(filters.page).toBe(2);
    expect(filters.onlyPromotions).toBe(true);
    expect(filters.loyaltyCard).toBe('NOT_REQUIRED');
    expect(filters.includeOnline).toBe(false);
  });

  it('negeert ongeldige waarden', () => {
    const filters = parseSearchParams(new URLSearchParams('sorteer=HACK&pagina=-3&merktype=X&eenheid=POUND'));
    expect(filters.sort).toBe('UNIT_PRICE');
    expect(filters.page).toBe(1);
    expect(filters.brandType).toBe('');
    expect(filters.unit).toBe('');
  });

  it('schrijft alleen afwijkingen van de standaard terug', () => {
    expect(serializeSearchParams({ ...DEFAULT_FILTERS, q: 'melk' }).toString()).toBe('q=melk');
    const params = serializeSearchParams({ ...DEFAULT_FILTERS, q: 'cola', chains: ['lidl'], maxPrice: '2,50', page: 3, sort: 'PACKAGE_PRICE', includeOnline: false });
    expect(params.get('winkels')).toBe('lidl');
    expect(params.get('maxprijs')).toBe('2,50');
    expect(params.get('pagina')).toBe('3');
    expect(params.get('sorteer')).toBe('PACKAGE_PRICE');
    expect(params.get('online')).toBe('0');
  });

  it('is een rondreis: parse(serialize(x)) == x', () => {
    const original = { ...DEFAULT_FILTERS, q: 'kipfilet 500 g', chains: ['delhaize', 'spar'], category: 'vlees-vis', brand: 'Boni', brandType: 'STORE_BRAND' as const, onlyPromotions: true, unit: 'KG' as const, maxPrice: '9,99', page: 2 };
    expect(parseSearchParams(serializeSearchParams(original))).toEqual(original);
  });

  it('zet de maximumprijs om naar centen voor de API en laat lege filters weg', () => {
    const query = toSearchQuery({ ...DEFAULT_FILTERS, q: 'melk', maxPrice: '2,50', brand: '', category: '' });
    expect(query.maxPriceCents).toBe(250);
    expect('brand' in query).toBe(false);
    expect('category' in query).toBe(false);
    expect(query.pageSize).toBe(20);
  });

  it('telt actieve filters', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, chains: ['lidl'], onlyPromotions: true, maxPrice: 'abc' })).toBe(2);
  });
});
