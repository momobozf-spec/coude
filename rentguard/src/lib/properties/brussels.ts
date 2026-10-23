/**
 * Postcodes van het Brussels Hoofdstedelijk Gewest.
 *
 * RentGuard is op Brussels huurrecht gebouwd. Een woning in Vlaanderen of
 * Wallonië valt onder een ander decreet, met andere termijnen en andere
 * indexatieregels. De app zou zo'n gebruiker verkeerd informeren, dus weigeren
 * wij die woning in plaats van hem stil verkeerd te behandelen.
 *
 * De onderstaande koppeling dekt de hoofdpostcodes van de negentien gemeenten.
 * Een postcode die binnen het bereik 1000–1299 valt maar hier niet in staat,
 * wordt aanvaard: de gebruiker vult de gemeente dan zelf in. Zo blokkeren wij
 * geen geldig adres door een onvolledige lijst.
 */

export const BRUSSELS_POSTAL_RANGE = { min: 1000, max: 1299 } as const;

export interface BrusselsMunicipality {
  nl: string;
  fr: string;
}

export const POSTAL_CODE_TO_MUNICIPALITY: Record<string, BrusselsMunicipality> = {
  '1000': { nl: 'Brussel', fr: 'Bruxelles' },
  '1005': { nl: 'Brussel', fr: 'Bruxelles' },
  '1020': { nl: 'Laken', fr: 'Laeken' },
  '1030': { nl: 'Schaarbeek', fr: 'Schaerbeek' },
  '1040': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1041': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1043': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1044': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1045': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1046': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1047': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1048': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1049': { nl: 'Etterbeek', fr: 'Etterbeek' },
  '1050': { nl: 'Elsene', fr: 'Ixelles' },
  '1060': { nl: 'Sint-Gillis', fr: 'Saint-Gilles' },
  '1070': { nl: 'Anderlecht', fr: 'Anderlecht' },
  '1080': { nl: 'Sint-Jans-Molenbeek', fr: 'Molenbeek-Saint-Jean' },
  '1081': { nl: 'Koekelberg', fr: 'Koekelberg' },
  '1082': { nl: 'Sint-Agatha-Berchem', fr: 'Berchem-Sainte-Agathe' },
  '1083': { nl: 'Ganshoren', fr: 'Ganshoren' },
  '1090': { nl: 'Jette', fr: 'Jette' },
  '1120': { nl: 'Neder-Over-Heembeek', fr: 'Neder-Over-Heembeek' },
  '1130': { nl: 'Haren', fr: 'Haren' },
  '1140': { nl: 'Evere', fr: 'Evere' },
  '1150': { nl: 'Sint-Pieters-Woluwe', fr: 'Woluwe-Saint-Pierre' },
  '1160': { nl: 'Oudergem', fr: 'Auderghem' },
  '1170': { nl: 'Watermaal-Bosvoorde', fr: 'Watermael-Boitsfort' },
  '1180': { nl: 'Ukkel', fr: 'Uccle' },
  '1190': { nl: 'Vorst', fr: 'Forest' },
  '1200': { nl: 'Sint-Lambrechts-Woluwe', fr: 'Woluwe-Saint-Lambert' },
  '1210': { nl: 'Sint-Joost-ten-Node', fr: 'Saint-Josse-ten-Noode' },
};

export function isBrusselsPostalCode(value: string): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const numeric = Number.parseInt(value, 10);
  return (
    numeric >= BRUSSELS_POSTAL_RANGE.min && numeric <= BRUSSELS_POSTAL_RANGE.max
  );
}

/** Gemeente bij een postcode, of null wanneer die niet in de lijst staat. */
export function municipalityFor(
  postalCode: string,
  locale: 'nl' | 'fr',
): string | null {
  return POSTAL_CODE_TO_MUNICIPALITY[postalCode]?.[locale] ?? null;
}

/** Alle gemeenten, alfabetisch, voor een keuzelijst. */
export function municipalityOptions(locale: 'nl' | 'fr'): string[] {
  return [
    ...new Set(
      Object.values(POSTAL_CODE_TO_MUNICIPALITY).map((entry) => entry[locale]),
    ),
  ].sort((a, b) => a.localeCompare(b, locale === 'nl' ? 'nl-BE' : 'fr-BE'));
}
