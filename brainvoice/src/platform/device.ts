import * as Crypto from 'expo-crypto';
import * as Localization from 'expo-localization';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import type { Language } from '@core/types/common';
import { setIdGenerator } from '@core/util/id';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/** Installs expo-crypto's UUID generator into the domain layer. */
export function installIdGenerator(): void {
  setIdGenerator(() => Crypto.randomUUID());
}

export function getDeviceLanguage(): Language {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return code === 'nl' || code === 'fr' ? code : 'en';
}

const DEFAULT_LOCALE_TAGS: Record<Language, string> = { en: 'en-GB', nl: 'nl-BE', fr: 'fr-BE' };

/** BCP-47 tag for the speech recogniser. Uses the device tag when it matches the chosen language. */
export function getSpeechLocale(language: Language): string {
  const device = Localization.getLocales()[0];
  if (device?.languageCode === language && device.languageTag) return device.languageTag;
  return DEFAULT_LOCALE_TAGS[language];
}

export function getDeviceTimezone(): string {
  const fromCalendar = Localization.getCalendars()[0]?.timeZone;
  if (fromCalendar) return fromCalendar;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function subscribeOnline(listener: (online: boolean) => void): () => void {
  try {
    const subscription = Network.addNetworkStateListener((state) => listener(Boolean(state.isConnected) && state.isInternetReachable !== false));
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}
