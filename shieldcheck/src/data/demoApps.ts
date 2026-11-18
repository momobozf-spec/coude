/**
 * VOORBEELDGEGEVENS — geen echte toestelscan.
 *
 * iOS geeft apps geen lijst van andere geïnstalleerde apps of hun toestemmingen.
 * Op Android vereist zo'n lijst de beperkte toestemming QUERY_ALL_PACKAGES plus een
 * eigen native module; beide zitten bewust niet in dit prototype.
 * Daarom tonen we op beide platformen fictieve apps om te demonstreren hoe dit
 * scherm eruit zou kunnen zien.
 */
export interface DemoApp {
  name: string;
  permissions: string[];
  note: string;
  level: 'ok' | 'attention';
}

export const DEMO_APPS: DemoApp[] = [
  {
    name: 'Zaklamp Plus (voorbeeld)',
    permissions: ['Locatie', 'Contacten', 'Camera'],
    note: 'Een zaklamp heeft normaal alleen de camera-flits nodig. Toegang tot locatie en contacten is ongebruikelijk.',
    level: 'attention',
  },
  {
    name: 'Fotobewerker Studio (voorbeeld)',
    permissions: ['Foto’s', 'Microfoon'],
    note: 'Toegang tot foto’s past bij deze app. Microfoon is alleen nodig als je video met geluid bewerkt.',
    level: 'attention',
  },
  {
    name: 'Weer Vandaag (voorbeeld)',
    permissions: ['Locatie (bij gebruik)'],
    note: 'Locatie alleen tijdens gebruik is redelijk voor een weer-app.',
    level: 'ok',
  },
  {
    name: 'Notities Simpel (voorbeeld)',
    permissions: [],
    note: 'Geen bijzondere toestemmingen.',
    level: 'ok',
  },
];
