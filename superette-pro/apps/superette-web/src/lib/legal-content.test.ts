import { describe, expect, it } from 'vitest';
import { LEGAL_ENTITY, legalAddress } from './legal';
import { LEGAL_DOCUMENTS } from './legal-content';
import { messages } from './messages';

const LOCALES = ['nl', 'fr', 'en'] as const;
const allText = (value: unknown): string => JSON.stringify(value);

describe('juridische teksten', () => {
  it('bestaan in elke taal met dezelfde secties en een conceptvermelding', () => {
    for (const docs of Object.values(LEGAL_DOCUMENTS)) {
      const ids = docs.nl.sections.map((section) => section.id);
      for (const locale of LOCALES) {
        expect(docs[locale].sections.map((section) => section.id)).toEqual(ids);
        expect(docs[locale].draftNotice.toLowerCase()).toMatch(/jurist|juriste|lawyer/);
      }
    }
  });

  it('noemen de uitbater via plaatshouders en verzinnen geen adres', () => {
    for (const locale of LOCALES) {
      const privacy = allText(LEGAL_DOCUMENTS.privacy[locale]);
      expect(privacy).toContain('{name}');
      expect(privacy).toContain('{kbo}');
      expect(privacy).toContain('{address}');
      expect(allText(LEGAL_DOCUMENTS.terms[locale])).toContain('{address}');
    }
    expect(LEGAL_ENTITY).toEqual({ name: 'Marhaba Data & AI Agent BV', enterpriseNumber: 'BE 1003.552.102', city: 'Zaventem', email: 'momobozf@gmail.com' });
    expect(legalAddress({})).toBeNull();
    expect(legalAddress({ LEGAL_ENTITY_ADDRESS: '  ' })).toBeNull();
    expect(legalAddress({ LEGAL_ENTITY_ADDRESS: 'Straat 1, 1930 Zaventem' })).toBe('Straat 1, 1930 Zaventem');
  });

  it('bevatten geen boetiekbranding en geen bewering dat er niet gescrapet wordt', () => {
    const everything = allText(LEGAL_DOCUMENTS) + allText(messages);
    expect(everything).not.toMatch(/Jamal|Jamila|Marhaba Cooperation/);
    expect(everything).not.toMatch(/scrapet geen|ne scrape aucun|does not scrape/i);
  });
});
