import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeFromAcceptLanguage,
  resolveLocale,
} from '@/i18n/config';
import { format, getMessages, getMessagesFor } from '@/i18n';

describe('locales', () => {
  it('ondersteunt Nederlands en Frans', () => {
    expect([...LOCALES]).toEqual(['nl', 'fr']);
  });

  it('gebruikt Frans als standaard', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('herkent geldige taalcodes', () => {
    expect(isLocale('nl')).toBe(true);
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('valt terug op de standaardtaal', () => {
    expect(resolveLocale('de')).toBe('fr');
    expect(resolveLocale(undefined)).toBe('fr');
    expect(resolveLocale('nl')).toBe('nl');
  });
});

describe('localeFromAcceptLanguage', () => {
  it('kiest Nederlands bij een Belgisch-Nederlandse header', () => {
    expect(localeFromAcceptLanguage('nl-BE,nl;q=0.9,en;q=0.8')).toBe('nl');
  });

  it('kiest Frans bij een Franse header', () => {
    expect(localeFromAcceptLanguage('fr-BE,fr;q=0.9')).toBe('fr');
  });

  it('volgt de kwaliteitswaarden', () => {
    expect(localeFromAcceptLanguage('en;q=1.0,nl;q=0.9,fr;q=0.5')).toBe('nl');
  });

  it('valt terug op de standaardtaal bij een onbekende taal', () => {
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9')).toBe('fr');
    expect(localeFromAcceptLanguage(null)).toBe('fr');
  });
});

describe('getMessages', () => {
  it('geeft de juiste taal terug', () => {
    expect(getMessages('nl').common.language).toBe('Taal');
    expect(getMessages('fr').common.language).toBe('Langue');
  });

  it('valt terug op de standaardtaal bij onbekende invoer', () => {
    expect(getMessagesFor('de').common.language).toBe('Langue');
  });

  it('bevat in beide talen de disclaimer', () => {
    expect(getMessages('nl').legal.disclaimer).toContain('geen juridisch advies');
    expect(getMessages('fr').legal.disclaimer).toContain('pas de conseil');
  });
});

describe('format', () => {
  it('vult placeholders in', () => {
    expect(format('Nog {days} dagen', { days: 12 })).toBe('Nog 12 dagen');
  });

  it('vult meerdere placeholders in', () => {
    expect(
      format('Medeondertekend door {name} op {date}', {
        name: 'Dupont',
        date: '01/03/2026',
      }),
    ).toBe('Medeondertekend door Dupont op 01/03/2026');
  });

  it('laat een ontbrekende waarde zichtbaar in plaats van undefined te tonen', () => {
    expect(format('Nog {days} dagen', {})).toBe('Nog {days} dagen');
  });
});
