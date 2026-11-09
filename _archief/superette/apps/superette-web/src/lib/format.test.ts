import { describe, expect, it } from 'vitest';
import { centsToEuroInput, euroInputToCents, formatDate, formatEuro, formatRelative, formatUnitPrice, joinNatural } from './format';

const nbsp = (text: string) => text.replace(/ | /g, ' ');

describe('Belgische geldnotatie', () => {
  it('toont centen als euro in nl-BE, fr-BE en en-BE', () => {
    expect(nbsp(formatEuro(179, 'nl'))).toBe('€ 1,79');
    expect(nbsp(formatEuro(123456, 'nl'))).toBe('€ 1.234,56');
    expect(nbsp(formatEuro(179, 'fr'))).toBe('1,79 €');
    expect(nbsp(formatEuro(179, 'en'))).toBe('€1.79');
  });

  it('toont een eenheidsprijs met de juiste eenheid', () => {
    expect(nbsp(formatUnitPrice(119, 'L', 'nl'))).toBe('€ 1,19/l');
    expect(nbsp(formatUnitPrice(1298, 'KG', 'nl'))).toBe('€ 12,98/kg');
    expect(nbsp(formatUnitPrice(50, 'PIECE', 'fr'))).toBe('0,50 €/pièce');
  });

  it('leest prijsinvoer met komma of punt en weigert onzin', () => {
    expect(euroInputToCents('1,79')).toBe(179);
    expect(euroInputToCents('1.79')).toBe(179);
    expect(euroInputToCents('€ 2')).toBe(200);
    expect(euroInputToCents('')).toBeNull();
    expect(euroInputToCents('abc')).toBeNull();
    expect(euroInputToCents('-1')).toBeNull();
  });

  it('schrijft centen terug als Belgische invoer', () => {
    expect(centsToEuroInput(179)).toBe('1,79');
    expect(centsToEuroInput(5)).toBe('0,05');
    expect(centsToEuroInput(null)).toBe('');
  });
});

describe('datums in Europe/Brussels', () => {
  const iso = '2026-10-04T06:30:00.000Z'; // 08:30 Belgische zomertijd

  it('formatteert datum en tijd in de Belgische tijdzone', () => {
    expect(formatDate(iso, 'nl', 'dateTime')).toMatch(/4 okt\.? 2026,? 08:30/);
    expect(formatDate(iso, 'fr', 'date')).toMatch(/4 oct\.? 2026/);
    expect(formatDate(iso, 'en', 'time')).toMatch(/08:30/);
  });

  it('geeft een relatieve tijd en valt na 30 dagen terug op een datum', () => {
    const now = new Date('2026-10-04T10:30:00.000Z');
    expect(formatRelative(iso, 'nl', now)).toMatch(/4 uur geleden/);
    expect(formatRelative('2026-10-03T10:30:00.000Z', 'nl', now)).toBe('gisteren');
    expect(formatRelative('2026-08-01T10:30:00.000Z', 'nl', now)).toMatch(/1 aug\.? 2026/);
    expect(formatRelative(iso, 'fr', now)).toMatch(/il y a 4 heures/);
  });

  it('geeft een lege tekst bij een ongeldige datum', () => {
    expect(formatDate('niet-een-datum', 'nl')).toBe('');
  });
});

describe('joinNatural', () => {
  it('maakt een natuurlijke opsomming per taal', () => {
    expect(joinNatural(['Delhaize', 'Lidl', 'Colruyt'], 'nl')).toBe('Delhaize, Lidl of Colruyt');
    expect(joinNatural(['Delhaize', 'Lidl'], 'fr')).toBe('Delhaize ou Lidl');
    expect(joinNatural(['Delhaize', 'Lidl'], 'en', 'and')).toBe('Delhaize and Lidl');
    expect(joinNatural(['Delhaize'], 'nl')).toBe('Delhaize');
  });
});
