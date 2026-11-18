import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type { SettingsTarget } from './types';

const ANDROID_ACTIONS: Record<SettingsTarget, string> = {
  general: IntentLauncher.ActivityAction.SETTINGS,
  security: IntentLauncher.ActivityAction.SECURITY_SETTINGS,
  privacy: IntentLauncher.ActivityAction.PRIVACY_SETTINGS,
  wifi: IntentLauncher.ActivityAction.WIFI_SETTINGS,
  appSettings: IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
};

/**
 * Kan deze instelling met een knop geopend worden?
 * iOS staat apps alleen toe hun eigen instellingenpagina te openen.
 */
export function canOpenSettings(target: SettingsTarget): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return target === 'appSettings';
  return false;
}

export function settingsButtonLabel(target: SettingsTarget): string {
  switch (target) {
    case 'general':
      return 'Open Instellingen';
    case 'security':
      return 'Open beveiligingsinstellingen';
    case 'privacy':
      return 'Open privacy-instellingen';
    case 'wifi':
      return 'Open wifi-instellingen';
    case 'appSettings':
      return 'Open instellingen van ShieldCheck';
  }
}

/** Opent de gevraagde systeeminstellingen. Geeft false terug als dat niet lukte. */
export async function openSettings(target: SettingsTarget): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      if (target === 'appSettings') {
        await Linking.openSettings();
        return true;
      }
      try {
        await IntentLauncher.startActivityAsync(ANDROID_ACTIONS[target]);
      } catch {
        // Niet elk merk ondersteunt elk scherm: val terug op de algemene instellingen.
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS);
      }
      return true;
    }
    if (Platform.OS === 'ios' && target === 'appSettings') {
      await Linking.openSettings();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
