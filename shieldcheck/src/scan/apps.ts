import { Platform } from 'react-native';

import type { CheckResult } from './types';

export function runAppChecks(): CheckResult[] {
  const isIos = Platform.OS === 'ios';
  return [
    {
      id: 'apps_inventory',
      module: 'apps',
      title: 'Toestemmingen van andere apps',
      source: 'limited',
      outcome: 'unknown',
      weight: 0,
      summary: isIos
        ? 'iOS geeft apps geen lijst van andere apps of hun toestemmingen.'
        : 'Niet uitgelezen in dit prototype.',
      detail: isIos
        ? 'Dit is een bewuste privacykeuze van Apple. Je kunt toestemmingen zelf nakijken in Instellingen.'
        : 'Op Android vraagt een volledige app-lijst de beperkte toestemming QUERY_ALL_PACKAGES (streng gereguleerd in Google Play) en een eigen native module. ShieldCheck vraagt die toestemming bewust niet. Hieronder zie je daarom voorbeeldgegevens.',
      settings: isIos ? undefined : 'privacy',
      manualSteps: isIos
        ? 'Open Instellingen > Privacy en beveiliging. Tik per categorie (Locatie, Contacten, Camera, Microfoon, Foto’s) om te zien welke apps toegang hebben.'
        : 'Open Instellingen > Beveiliging en privacy > Privacy > Toestemmingsbeheer (de naam verschilt per merk). Kies per categorie welke apps toegang krijgen.',
    },
  ];
}

/** Vaste informatie over de app zelf (komt uit de app-configuratie, geen toestelscan). */
export function ownPermissionsText(): string {
  return Platform.OS === 'ios'
    ? 'ShieldCheck vraagt op iOS geen enkele toestemming: geen locatie, contacten, camera, microfoon, foto’s of berichten.'
    : 'ShieldCheck vraagt op Android geen toegang tot locatie, contacten, camera, microfoon, sms of je bestanden; die rechten zijn in de app-configuratie geblokkeerd. De app gebruikt alleen standaardrechten zonder pop-up: netwerkstatus lezen, het type schermvergrendeling opvragen en internettoegang (standaard in Expo-apps).';
}
