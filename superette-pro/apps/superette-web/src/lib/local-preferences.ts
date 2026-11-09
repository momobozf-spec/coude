/**
 * Winkelvoorkeuren voor bezoekers zonder account: lokaal in de browser.
 *
 * Zelfde vorm als `ComparePreferences` uit de contracten, zodat een bezoeker
 * die later een account maakt zijn voorkeuren in één keer kan overnemen.
 * Lezen en schrijven zijn beschermd: in een privévenster of met geblokkeerde
 * opslag werkt de app gewoon verder met de standaardwaarden.
 */
import { comparePreferencesSchema, DEFAULT_COMPARE_PREFERENCES, type ComparePreferences } from '@superette/contracts';

export const GUEST_PREFERENCES_KEY = 'superette.guest-preferences';

export function readGuestPreferences(storage: Pick<Storage, 'getItem'> | null = safeStorage()): ComparePreferences {
  if (!storage) return DEFAULT_COMPARE_PREFERENCES;
  try {
    const raw = storage.getItem(GUEST_PREFERENCES_KEY);
    if (!raw) return DEFAULT_COMPARE_PREFERENCES;
    const parsed = comparePreferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_COMPARE_PREFERENCES;
  } catch {
    return DEFAULT_COMPARE_PREFERENCES;
  }
}

export function writeGuestPreferences(
  preferences: ComparePreferences,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GUEST_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function mergePreferences(base: ComparePreferences, patch: Partial<ComparePreferences>): ComparePreferences {
  return { ...base, ...patch };
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
