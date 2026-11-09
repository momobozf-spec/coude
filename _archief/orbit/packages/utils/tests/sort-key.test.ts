import { describe, expect, it } from 'vitest';
import {
  appendSortKey,
  generateSortKey,
  generateSortKeys,
  prependSortKey,
} from '../src/sort-key';

describe('fractional sort keys', () => {
  it('geeft een sleutel voor een lege lijst', () => {
    const key = generateSortKey(null, null);
    expect(key.length).toBeGreaterThan(0);
    expect(key.endsWith('0')).toBe(false);
  });

  it('plaatst een nieuwe sleutel strikt tussen twee bestaande', () => {
    const first = generateSortKey(null, null);
    const second = appendSortKey(first);
    const between = generateSortKey(first, second);
    expect(between > first).toBe(true);
    expect(between < second).toBe(true);
  });

  it('blijft correct bij herhaald invoegen op dezelfde plek', () => {
    let low = generateSortKey(null, null);
    const high = appendSortKey(low);
    const inserted: string[] = [];
    for (let i = 0; i < 200; i++) {
      const key = generateSortKey(low, high);
      expect(key > low).toBe(true);
      expect(key < high).toBe(true);
      inserted.push(key);
      low = key;
    }
    const sorted = [...inserted].sort();
    expect(sorted).toEqual(inserted);
  });

  it('houdt de volgorde aan als je steeds vooraan invoegt', () => {
    let head = generateSortKey(null, null);
    for (let i = 0; i < 100; i++) {
      const key = prependSortKey(head);
      expect(key < head).toBe(true);
      head = key;
    }
  });

  it('houdt de volgorde aan als je steeds achteraan toevoegt', () => {
    let tail = generateSortKey(null, null);
    for (let i = 0; i < 100; i++) {
      const key = appendSortKey(tail);
      expect(key > tail).toBe(true);
      tail = key;
    }
  });

  it('genereert een reeks oplopende sleutels in een keer', () => {
    const keys = generateSortKeys(null, null, 25);
    expect(keys).toHaveLength(25);
    expect([...keys].sort()).toEqual(keys);
  });

  it('weigert grenzen in de verkeerde volgorde', () => {
    const a = generateSortKey(null, null);
    const b = appendSortKey(a);
    expect(() => generateSortKey(b, a)).toThrow();
  });

  it('sorteert een gesleepte lijst zoals de gebruiker hem ziet', () => {
    // Drie items; het derde wordt naar plek 1 gesleept.
    const keys = generateSortKeys(null, null, 3) as [string, string, string];
    const moved = generateSortKey(null, keys[0]);
    const order = [
      { id: 'c', key: moved },
      { id: 'a', key: keys[0] },
      { id: 'b', key: keys[1] },
      { id: 'x', key: keys[2] },
    ].sort((l, r) => (l.key < r.key ? -1 : 1));
    expect(order.map((entry) => entry.id)).toEqual(['c', 'a', 'b', 'x']);
  });
});
