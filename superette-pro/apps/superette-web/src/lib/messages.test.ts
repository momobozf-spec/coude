import { describe, expect, it } from 'vitest';
import { translate } from './i18n';
import { messages, type MessageKey } from './messages';

describe('vertalingen', () => {
  const keys = Object.keys(messages.nl) as MessageKey[];

  it('hebben in elke taal dezelfde sleutels en geen lege teksten', () => {
    for (const locale of ['nl', 'fr', 'en'] as const) {
      expect(Object.keys(messages[locale]).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(messages[locale][key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
  });

  it('gebruiken in elke taal dezelfde plaatshouders', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of keys) {
      expect(placeholders(messages.fr[key]), `fr:${key}`).toEqual(placeholders(messages.nl[key]));
      expect(placeholders(messages.en[key]), `en:${key}`).toEqual(placeholders(messages.nl[key]));
    }
  });

  it('vullen plaatshouders in en laten onbekende staan', () => {
    expect(translate('nl', 'search.results', { n: 12 })).toBe('12 producten gevonden');
    expect(translate('fr', 'alerts.difference.above', { amount: '0,10 €' })).toBe('Encore 0,10 € au-dessus de votre cible');
    expect(translate('nl', 'coverage.summary', { with: 5 })).toBe('Prijzen van 5 van de {total} geselecteerde supermarkten zijn gecontroleerd.');
  });

  it('markeren demogegevens expliciet in elke taal', () => {
    for (const locale of ['nl', 'fr', 'en'] as const) {
      expect(messages[locale]['app.demoBanner'].toLowerCase()).toMatch(/demo|démo/);
      expect(messages[locale]['status.DEMO'].toLowerCase()).toMatch(/demo|démo/);
    }
  });
});
