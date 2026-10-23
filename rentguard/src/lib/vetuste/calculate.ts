/**
 * Slijtageberekening (vétusté).
 *
 * Implementeert de methode uit het officiële Waalse "Guide d'utilisation" bij
 * de grille indicative de vétusté:
 *
 *   1. zoek levensduur en afschrijvingspercentage van de uitrusting op;
 *   2. bepaal de leeftijd van de uitrusting bij intrek;
 *   3. pas het percentage toe per gebruiksjaar — elk BEGONNEN jaar telt volledig;
 *   4. laat een vakman de herstelkost ramen;
 *   5. het bekomen afschrijvingspercentage bepaalt het deel voor de verhuurder,
 *      de rest is voor de huurder.
 *
 * BELANGRIJK — dit is Waals recht. Er bestaat geen officieel slijtagerooster
 * voor het Brussels Hoofdstedelijk Gewest en een Brusselse rechter is hier niet
 * aan gebonden. De uitkomst is een onderbouwde indicatie, geen vaststelling.
 * Zie docs/juridisch.md §5.
 *
 * Bron: Service public de Wallonie, "Grille indicative de vétusté — Guide
 * d'utilisation", geraadpleegd 2026-08-29. Wettelijke achtergrond in dat
 * document: Decreet van 15 maart 2018 betreffende de woninghuurovereenkomst,
 * art. 7, 8, 15 en 16 (Waals Gewest).
 */

/**
 * Gevallen waarin de grille volgens het brondocument NIET van toepassing is.
 * In die gevallen draagt de huurder de kost; de slijtageberekening wordt
 * overgeslagen.
 */
export type VetusteExclusion =
  | 'VOLUNTARY_DAMAGE'
  | 'VANDALISM'
  | 'ABUSIVE_USE'
  | 'HYGIENE_FAILURE'
  | 'UNAUTHORISED_TRANSFORMATION'
  | 'LOST_OR_REMOVED_EQUIPMENT'
  | 'TENANT_LIABILITY_ESTABLISHED'
  | 'TENANT_MAY_REDECORATE_FREELY';

export interface VetusteInput {
  /** Theoretische levensduur in jaren, uit de grille. */
  lifetimeYears: number;
  /** Jaarlijks afschrijvingspercentage zoals de grille het afdrukt. */
  abattementPct: number;
  /** Leeftijd van de uitrusting op het moment van intrek, in jaren. */
  equipmentAgeAtEntryYears: number;
  /** Duur van de bewoning door deze huurder, in jaren. */
  tenantOccupancyYears: number;
  /** Geraamde herstel- of vervangingskost, in eurocent. */
  repairCostCents: number;
  /** Reden waarom de grille niet toegepast mag worden, indien van toepassing. */
  exclusion?: VetusteExclusion | null;
}

export interface VetusteResult {
  /** Is de grille toegepast? */
  applies: boolean;
  exclusion: VetusteExclusion | null;
  /** Toegepast afschrijvingspercentage, 0–100. */
  abattementPct: number;
  /** Aantal in rekening gebrachte jaren (begonnen jaren tellen volledig). */
  chargedYears: number;
  /** Is de uitrusting voorbij haar theoretische levensduur? */
  beyondLifetime: boolean;
  tenantShareCents: number;
  landlordShareCents: number;
}

export class InvalidVetusteInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVetusteInputError';
  }
}

/** "Toute année commencée est considérée comme échue." */
function commencedYears(years: number): number {
  if (years < 0) {
    throw new InvalidVetusteInputError(
      'Een aantal jaren kan niet negatief zijn.',
    );
  }
  return Math.ceil(years);
}

export function calculateVetuste(input: VetusteInput): VetusteResult {
  const {
    lifetimeYears,
    abattementPct,
    equipmentAgeAtEntryYears,
    tenantOccupancyYears,
    repairCostCents,
    exclusion = null,
  } = input;

  if (!Number.isFinite(lifetimeYears) || lifetimeYears <= 0) {
    throw new InvalidVetusteInputError(
      'De levensduur moet een positief getal zijn.',
    );
  }
  if (!Number.isFinite(abattementPct) || abattementPct <= 0) {
    throw new InvalidVetusteInputError(
      'Het afschrijvingspercentage moet een positief getal zijn.',
    );
  }
  if (!Number.isInteger(repairCostCents) || repairCostCents < 0) {
    throw new InvalidVetusteInputError(
      'De herstelkost moet een geheel aantal eurocent zijn, niet negatief.',
    );
  }

  // Uitsluitingen: de grille wordt niet toegepast, de huurder draagt de kost.
  if (exclusion) {
    return {
      applies: false,
      exclusion,
      abattementPct: 0,
      chargedYears: 0,
      beyondLifetime: false,
      tenantShareCents: repairCostCents,
      landlordShareCents: 0,
    };
  }

  const chargedYears =
    commencedYears(equipmentAgeAtEntryYears) +
    commencedYears(tenantOccupancyYears);

  const beyondLifetime = chargedYears >= lifetimeYears;

  // Voorbij de theoretische levensduur is de uitrusting volledig afgeschreven:
  // de huurder draagt niets meer.
  const applied = beyondLifetime
    ? 100
    : Math.min(100, chargedYears * abattementPct);

  const landlordShareCents = Math.round((repairCostCents * applied) / 100);
  const tenantShareCents = repairCostCents - landlordShareCents;

  return {
    applies: true,
    exclusion: null,
    abattementPct: applied,
    chargedYears,
    beyondLifetime,
    tenantShareCents,
    landlordShareCents,
  };
}

/**
 * Vertaalt een gebruikersoordeel over een fotopaar naar de vraag of de grille
 * überhaupt aan de orde is.
 *
 * Bij `WEAR_AND_TEAR` is er per definitie niets ten laste van de huurder: de
 * slijtageberekening is dan niet nodig. Bij `DAMAGE` is ze dat wel, tenzij de
 * gebruiker een uitsluitingsgrond heeft aangeduid.
 */
export function vetusteApplies(
  verdict: 'WEAR_AND_TEAR' | 'DAMAGE' | 'UNCLEAR',
): boolean {
  return verdict === 'DAMAGE';
}
