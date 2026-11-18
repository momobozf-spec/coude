import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { OS_REFERENCE } from '../data/osReference';
import { evaluateOsVersion } from './osVersion';
import type { CheckResult } from './types';

function osLabel(): string {
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'Android';
  return Device.osName ?? 'je besturingssysteem';
}

export function checkOsVersion(): CheckResult {
  const name = osLabel();
  const version = Device.osVersion;
  const base = {
    id: 'os_version',
    module: 'system' as const,
    title: 'Versie van het besturingssysteem',
    settings: 'general' as const,
    manualSteps:
      Platform.OS === 'ios'
        ? 'Open Instellingen > Algemeen > Software-update.'
        : 'Open Instellingen > Systeem > Software-update (de naam verschilt per merk).',
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      ...base,
      source: 'unchecked',
      outcome: 'unknown',
      weight: 0,
      summary: 'Deze controle werkt alleen op een iPhone of Android-toestel.',
    };
  }

  if (!version) {
    return {
      ...base,
      source: 'unchecked',
      outcome: 'unknown',
      weight: 0,
      summary: 'De OS-versie kon niet worden uitgelezen.',
    };
  }

  const { outcome } = evaluateOsVersion(Platform.OS, version);
  const emulatorNote = Device.isDevice ? '' : ' Let op: dit lijkt een simulator of emulator.';
  const detail =
    `Uitgelezen via het toestel (${name} ${version}). De beoordeling vergelijkt alleen de hoofdversie met een ingebouwde referentietabel (nagekeken ${OS_REFERENCE.reviewedOn}). ` +
    'ShieldCheck kan niet zien of er een update voor jouw toestel klaarstaat.' +
    emulatorNote;

  const summaries: Record<string, string> = {
    good: `${name} ${version} is een recente hoofdversie. Installeer updates nog steeds zodra ze verschijnen.`,
    attention: `${name} ${version} is niet meer de nieuwste hoofdversie. Kijk of er een update klaarstaat.`,
    risk: `Je ${name}-versie (${version}) lijkt verouderd. Controleer of er een update klaarstaat in Instellingen.`,
    unknown: `${name} ${version}: de versie kon niet worden beoordeeld.`,
  };

  return {
    ...base,
    source: 'verified',
    outcome,
    weight: outcome === 'unknown' ? 0 : 50,
    summary: summaries[outcome] ?? summaries.unknown,
    detail,
  };
}

export async function checkScreenLock(): Promise<CheckResult> {
  const base = {
    id: 'screen_lock',
    module: 'system' as const,
    title: 'Schermvergrendeling',
    settings: 'security' as const,
    manualSteps:
      Platform.OS === 'ios'
        ? 'Open Instellingen > Face ID en toegangscode (of Touch ID en toegangscode).'
        : 'Open Instellingen > Beveiliging (of Beveiliging en privacy) > Schermvergrendeling.',
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      ...base,
      source: 'unchecked',
      outcome: 'unknown',
      weight: 0,
      summary: 'Deze controle werkt alleen op een iPhone of Android-toestel.',
    };
  }

  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    const detail =
      'Uitgelezen via de systeem-API voor ontgrendeling (expo-local-authentication). ' +
      'ShieldCheck ziet alleen óf er een vergrendeling is en welk type, nooit je code of biometrische gegevens.';

    switch (level) {
      case LocalAuthentication.SecurityLevel.NONE:
        return {
          ...base,
          source: 'verified',
          outcome: 'risk',
          weight: 50,
          summary: 'Er lijkt geen schermvergrendeling ingesteld. Iedereen die je toestel oppakt, kan het dan openen.',
          detail,
        };
      case LocalAuthentication.SecurityLevel.SECRET:
        return {
          ...base,
          source: 'verified',
          outcome: 'good',
          weight: 50,
          summary: 'Er is een schermvergrendeling met pincode, patroon of wachtwoord ingesteld.',
          detail,
        };
      case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
      case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
        return {
          ...base,
          source: 'verified',
          outcome: 'good',
          weight: 50,
          summary: 'Er is een schermvergrendeling ingesteld, met biometrie (vingerafdruk of gezicht).',
          detail,
        };
      default:
        return {
          ...base,
          source: 'unchecked',
          outcome: 'unknown',
          weight: 0,
          summary: 'Het type vergrendeling kon niet worden vastgesteld.',
        };
    }
  } catch {
    return {
      ...base,
      source: 'unchecked',
      outcome: 'unknown',
      weight: 0,
      summary: 'De schermvergrendeling kon niet worden gecontroleerd op dit toestel.',
    };
  }
}

export function checkPatchLevel(): CheckResult {
  const isIos = Platform.OS === 'ios';
  return {
    id: 'patch_level',
    module: 'system',
    title: 'Datum beveiligingspatch',
    source: 'limited',
    outcome: 'unknown',
    weight: 0,
    summary: 'Niet beschikbaar op dit toestel.',
    detail: isIos
      ? 'iOS geeft apps geen aparte patchdatum. Beveiligingsfixes zitten in iOS-updates.'
      : 'Android kent een patchdatum, maar de Expo-modules in dit prototype kunnen die niet uitlezen. Daarvoor is een eigen native module nodig.',
    settings: 'general',
    manualSteps: isIos
      ? 'Open Instellingen > Algemeen > Info om je iOS-versie te zien.'
      : 'Open Instellingen > Over de telefoon > Android-versie > Android-beveiligingsupdate.',
  };
}

export function checkRootStatus(): CheckResult {
  const isIos = Platform.OS === 'ios';
  return {
    id: 'root_status',
    module: 'system',
    title: isIos ? 'Jailbreak-status' : 'Root-status',
    source: 'unchecked',
    outcome: 'unknown',
    weight: 0,
    summary: 'Niet gecontroleerd.',
    detail:
      'De beschikbare detectie (Device.isRootedExperimentalAsync) is volgens de documentatie experimenteel en niet volledig betrouwbaar. ' +
      'Om je geen vals gevoel van veiligheid of onnodige ongerustheid te geven, tonen we hier geen resultaat.',
  };
}

export async function runSystemChecks(): Promise<CheckResult[]> {
  const screenLock = await checkScreenLock();
  return [checkOsVersion(), screenLock, checkPatchLevel(), checkRootStatus()];
}
