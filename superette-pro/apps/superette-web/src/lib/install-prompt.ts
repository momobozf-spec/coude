/**
 * "Installeer de app": wanneer en hoe we het voorstellen.
 *
 * - Android/Chromium: de browser vuurt `beforeinstallprompt`; wij tonen onze
 *   eigen knop en roepen daarmee de systeemdialoog op.
 * - iOS Safari kent dat event niet: daar tonen we twee korte stappen (Deel →
 *   Zet op beginscherm). Andere browsers op iOS kunnen niet installeren.
 * - Al geïnstalleerd (standalone) of onlangs weggeklikt: niets tonen.
 *
 * Opslag is altijd beschermd: in een privévenster werkt het gewoon zonder.
 */

export const INSTALL_DISMISSED_KEY = 'superette.install-dismissed';
/** Na "Niet nu" vragen we het pas na twee weken opnieuw. */
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPlatform = 'installed' | 'ios-safari' | 'ios-other' | 'other';

export function detectInstallPlatform(userAgent: string, standalone: boolean): InstallPlatform {
  if (standalone) return 'installed';
  const isIos = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  if (!isIos) return 'other';
  // Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS) e.a. op iOS: geen "Zet op beginscherm" via ons.
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/i.test(userAgent);
  return isSafari ? 'ios-safari' : 'ios-other';
}

export function isDismissed(storage: Pick<Storage, 'getItem'> | null, now = Date.now()): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && now - at < INSTALL_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function rememberDismissed(storage: Pick<Storage, 'setItem'> | null, now = Date.now()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(INSTALL_DISMISSED_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
