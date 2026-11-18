import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lokale opslag op het toestel (AsyncStorage). Alleen voorkeuren en afgevinkte acties;
 * geen e-mailadressen, geplakte berichten of scanresultaten.
 */
const KEYS = {
  onboarded: 'shieldcheck:onboarded:v1',
  completedActions: 'shieldcheck:completed-actions:v1',
} as const;

export async function loadOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS.onboarded)) === 'true';
  } catch {
    return false;
  }
}

export async function saveOnboarded(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.onboarded, value ? 'true' : 'false');
  } catch {
    // Opslag mislukt: de app blijft werken, alleen onthoudt hij het niet.
  }
}

export async function loadCompletedActions(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.completedActions);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveCompletedActions(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.completedActions, JSON.stringify(ids));
  } catch {
    // zie hierboven
  }
}
