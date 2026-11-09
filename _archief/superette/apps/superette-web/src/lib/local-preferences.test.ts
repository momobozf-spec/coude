import { DEFAULT_COMPARE_PREFERENCES } from '@superette/contracts';
import { describe, expect, it } from 'vitest';
import { GUEST_PREFERENCES_KEY, mergePreferences, readGuestPreferences, writeGuestPreferences } from './local-preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    store,
  };
}

describe('voorkeuren van bezoekers (lokaal)', () => {
  it('geeft standaardwaarden zonder opslag of zonder opgeslagen voorkeuren', () => {
    expect(readGuestPreferences(null)).toEqual(DEFAULT_COMPARE_PREFERENCES);
    expect(readGuestPreferences(memoryStorage())).toEqual(DEFAULT_COMPARE_PREFERENCES);
  });

  it('bewaart en leest voorkeuren terug', () => {
    const storage = memoryStorage();
    const prefs = mergePreferences(DEFAULT_COMPARE_PREFERENCES, { enabledChainSlugs: ['lidl', 'colruyt'], postalCode: '2000' });
    expect(writeGuestPreferences(prefs, storage)).toBe(true);
    expect(readGuestPreferences(storage)).toEqual(prefs);
  });

  it('negeert beschadigde of ongeldige opslag', () => {
    expect(readGuestPreferences(memoryStorage({ [GUEST_PREFERENCES_KEY]: '{niet json' }))).toEqual(DEFAULT_COMPARE_PREFERENCES);
    expect(readGuestPreferences(memoryStorage({ [GUEST_PREFERENCES_KEY]: JSON.stringify({ postalCode: '12' }) }))).toEqual(DEFAULT_COMPARE_PREFERENCES);
  });

  it('meldt een mislukte schrijfactie in plaats van te werpen', () => {
    const broken = {
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(writeGuestPreferences(DEFAULT_COMPARE_PREFERENCES, broken)).toBe(false);
  });
});
