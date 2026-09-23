import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator, formatPrice, formatQuantity, formatUnitPrice, resolveLocale } from './index.js';

type Tree = { [k: string]: string | Tree };
const keys = (o: Tree, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));

describe('catalogues', () => {
  it('fr and en have exactly the same keys as nl', () => {
    const nlKeys = keys(catalogs.nl as unknown as Tree).sort();
    expect(keys(catalogs.fr as unknown as Tree).sort()).toEqual(nlKeys);
    expect(keys(catalogs.en as unknown as Tree).sort()).toEqual(nlKeys);
  });

  it('interpolates and pluralises', () => {
    const t = createTranslator('nl');
    expect(t('alerts.notificationBody', { product: 'Coca-Cola Zero', price: '€ 1,89', retailer: 'Dirk' })).toBe(
      'Coca-Cola Zero is nu € 1,89 bij Dirk.',
    );
    expect(t('home.listSummary', { count: 1 })).toBe('1 product');
    expect(t('home.listSummary', { count: 12 })).toBe('12 producten');
    expect(createTranslator('fr')('lists.items', { count: 2 })).toBe('2 produits');
  });

  it('resolves locales with a Dutch fallback', () => {
    expect(resolveLocale('fr-BE')).toBe('fr');
    expect(resolveLocale('de')).toBe('nl');
    expect(resolveLocale(undefined)).toBe('nl');
  });
});

describe('formatting', () => {
  const clean = (s: string) => s.replace(/\u00a0|\u202f/g, ' ');
  it('formats prices per locale', () => {
    expect(clean(formatPrice(249, { locale: 'nl', country: 'BE' }))).toBe('€ 2,49');
    expect(clean(formatPrice(249, { locale: 'fr', country: 'BE' }))).toBe('2,49 €');
    expect(clean(formatPrice(249, { locale: 'nl', country: 'NL' }))).toBe('€ 2,49');
  });

  it('formats unit prices and quantities', () => {
    expect(clean(formatUnitPrice(133, 'l', { locale: 'nl' }))).toBe('€ 1,33/l');
    expect(clean(formatUnitPrice(33, 'piece', { locale: 'nl' }))).toBe('€ 0,33/stuk');
    expect(formatQuantity({ amount: 1.5, unit: 'l' }, { locale: 'nl' })).toBe('1,5 l');
    // English UI in Belgium keeps Belgian number conventions (en-BE).
    expect(formatQuantity({ amount: 1.5, unit: 'l' }, { locale: 'en' })).toBe('1,5 l');
    expect(formatQuantity({ amount: 33, unit: 'ml' }, { locale: 'fr', packCount: 6 })).toBe('6 x 33 ml');
    expect(formatQuantity({ amount: 12, unit: 'piece' }, { locale: 'nl' })).toBe('12 stuks');
  });
});
