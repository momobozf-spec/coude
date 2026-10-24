import { describe, expect, it } from 'vitest';
import { searchStem } from './search-terms';

// Echte productnamen uit de feeds van 7 oktober 2026.
const contains = (name: string, query: string) =>
  query.split(' ').map(searchStem).every((token) => name.toLowerCase().includes(token));

describe('searchStem', () => {
  it('"gerookte zalm" vindt ook Delhaize "Zalm Gerookt"', () => {
    expect(contains('Zalm Gerookt', 'gerookte zalm')).toBe(true);
    expect(contains('Gerookte zalm', 'gerookte zalm')).toBe(true);
  });

  it('meervoud vindt enkelvoud', () => {
    expect(searchStem('eieren')).toBe('eier');
    expect(contains('Kipfilet', 'kipfilets')).toBe(true);
  });

  it('korte woorden blijven ongemoeid', () => {
    for (const word of ['kaas', 'melk', 'cola', 'kip', 'brood']) expect(searchStem(word)).toBe(word);
  });

  it('woorden zonder buiging blijven gelijk', () => {
    expect(searchStem('gouda')).toBe('gouda');
    expect(searchStem('slagroom')).toBe('slagroom');
  });
});
