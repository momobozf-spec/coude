import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fr } from '@/i18n/messages/fr';
import { nl } from '@/i18n/messages/nl';
import {
  assertNoForbiddenTerms,
  findForbiddenTerms,
} from '@/lib/legal/forbidden-terms';

const ROOT = path.resolve(__dirname, '../../..');

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

describe('findForbiddenTerms', () => {
  it('vindt een claim van juridische waterdichtheid', () => {
    const hits = findForbiddenTerms(
      'Ons rapport is juridisch waterdicht en wordt altijd aanvaard.',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].match).toBe('juridisch waterdicht');
  });

  it('vindt een uitkomstgarantie in het Nederlands en het Frans', () => {
    expect(
      findForbiddenTerms('U krijgt gegarandeerd uw waarborg terug.'),
    ).toHaveLength(1);
    expect(
      findForbiddenTerms('Une garantie de remboursement de votre caution.'),
    ).toHaveLength(1);
  });

  it('vindt de term waarborg-garantie uit de conceptnota', () => {
    expect(findForbiddenTerms('Onze waarborg-garantie')).toHaveLength(1);
    expect(findForbiddenTerms('Onze waarborg garantie')).toHaveLength(1);
  });

  it('vindt een voorspelling van de procesuitkomst', () => {
    expect(findForbiddenTerms('Met dit dossier wint u zeker.')).toHaveLength(1);
  });

  it('laat correcte formuleringen ongemoeid', () => {
    const ok = [
      'Dit is bewijsmateriaal dat een rechter vrij beoordeelt.',
      'Een elektronische aangetekende zending via een gekwalificeerde dienst.',
      'Gewone e-mail — geen bewijs van ontvangst.',
      'La garantie locative s’élève à maximum deux mois de loyer.',
      'Un état des lieux contradictoire est obligatoire.',
    ];
    for (const text of ok) {
      expect(findForbiddenTerms(text), text).toEqual([]);
    }
  });

  it('geeft bruikbare context terug bij een treffer', () => {
    const hits = findForbiddenTerms(
      'Wij bieden u een dossier dat juridisch waterdicht is voor de rechter.',
    );
    expect(hits[0].context).toContain('juridisch waterdicht');
    expect(hits[0].reason).toBeTruthy();
  });
});

describe('assertNoForbiddenTerms', () => {
  it('werpt een fout met het label erin', () => {
    expect(() =>
      assertNoForbiddenTerms('Dit is gegarandeerd correct.', 'dispute_reasons'),
    ).toThrow(/dispute_reasons/);
  });

  it('laat een correcte tekst door', () => {
    expect(() =>
      assertNoForbiddenTerms('De termijn is verstreken op 1 maart.', 'veld'),
    ).not.toThrow();
  });
});

describe('vertaalbestanden', () => {
  it.each([
    ['nl', nl],
    ['fr', fr],
  ])('%s bevat geen verboden juridische claims', (_locale, messages) => {
    const hits = collectStrings(messages).flatMap((text) =>
      findForbiddenTerms(text),
    );
    expect(hits).toEqual([]);
  });

  it('nl en fr hebben exact dezelfde sleutels', () => {
    const keysOf = (value: unknown, prefix = ''): string[] => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [prefix];
      }
      return Object.entries(value).flatMap(([key, child]) =>
        keysOf(child, prefix ? `${prefix}.${key}` : key),
      );
    };

    expect(keysOf(fr).sort()).toEqual(keysOf(nl).sort());
  });
});

describe('brieftemplates in de migraties', () => {
  it('bevatten geen verboden juridische claims', () => {
    const dir = path.join(ROOT, 'supabase', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), 'utf8');
      expect(findForbiddenTerms(sql), file).toEqual([]);
    }
  });
});
