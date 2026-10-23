import { describe, expect, it } from 'vitest';

import {
  InvalidVetusteInputError,
  calculateVetuste,
  vetusteApplies,
} from '@/lib/vetuste/calculate';

/**
 * De drie testgevallen hieronder komen uit het officiële Waalse
 * "Guide d'utilisation" bij de grille indicative de vétusté (CAS DE FIGURE 1,
 * 2 en 3). Ze gebruiken binnenschilderwerk: levensduur 8 jaar, 12,50 % per jaar,
 * geraamde werken 1.500 EUR.
 */
const PAINT = { lifetimeYears: 8, abattementPct: 12.5 };
const COST = 150_000; // 1.500,00 EUR in cent

describe('officiële voorbeelden uit het Waalse guide', () => {
  it('CAS 1 — nieuw bij intrek, vijf jaar bewoning', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 0,
      tenantOccupancyYears: 5,
      repairCostCents: COST,
    });

    expect(result.abattementPct).toBe(62.5);
    expect(result.tenantShareCents).toBe(56_250); // 562,50 EUR
    expect(result.landlordShareCents).toBe(93_750); // 937,50 EUR
    expect(result.beyondLifetime).toBe(false);
  });

  it('CAS 2 — twee jaar oud bij intrek, vijf jaar bewoning', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 2,
      tenantOccupancyYears: 5,
      repairCostCents: COST,
    });

    expect(result.chargedYears).toBe(7);
    expect(result.abattementPct).toBe(87.5);
    expect(result.tenantShareCents).toBe(18_750); // 187,50 EUR
    expect(result.landlordShareCents).toBe(131_250); // 1.312,50 EUR
  });

  it('CAS 3 — voorbij de theoretische levensduur: huurder draagt niets', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 5,
      tenantOccupancyYears: 5,
      repairCostCents: COST,
    });

    expect(result.beyondLifetime).toBe(true);
    expect(result.abattementPct).toBe(100);
    expect(result.tenantShareCents).toBe(0);
    expect(result.landlordShareCents).toBe(COST);
  });
});

describe('begonnen jaren tellen volledig', () => {
  it('rondt een deel van een jaar naar boven af', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 0,
      tenantOccupancyYears: 2.1,
      repairCostCents: COST,
    });

    expect(result.chargedYears).toBe(3);
    expect(result.abattementPct).toBe(37.5);
  });

  it('telt een bewoning van nul jaar als nul', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 0,
      tenantOccupancyYears: 0,
      repairCostCents: COST,
    });

    expect(result.chargedYears).toBe(0);
    expect(result.abattementPct).toBe(0);
    expect(result.tenantShareCents).toBe(COST);
  });
});

describe('uitsluitingen', () => {
  it('past de grille niet toe bij vandalisme: de huurder draagt de kost', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 6,
      tenantOccupancyYears: 5,
      repairCostCents: COST,
      exclusion: 'VANDALISM',
    });

    expect(result.applies).toBe(false);
    expect(result.exclusion).toBe('VANDALISM');
    expect(result.tenantShareCents).toBe(COST);
    expect(result.landlordShareCents).toBe(0);
  });

  it('past de grille niet toe wanneer de huurder vrij mocht herschilderen', () => {
    const result = calculateVetuste({
      ...PAINT,
      equipmentAgeAtEntryYears: 0,
      tenantOccupancyYears: 3,
      repairCostCents: COST,
      exclusion: 'TENANT_MAY_REDECORATE_FREELY',
    });

    expect(result.applies).toBe(false);
  });
});

describe('afronding', () => {
  it('verdeelt zonder cent te verliezen', () => {
    const result = calculateVetuste({
      lifetimeYears: 15,
      abattementPct: 6.67,
      equipmentAgeAtEntryYears: 1,
      tenantOccupancyYears: 2,
      repairCostCents: 33_333,
    });

    expect(result.tenantShareCents + result.landlordShareCents).toBe(33_333);
  });
});

describe('ongeldige invoer', () => {
  it('weigert een levensduur van nul', () => {
    expect(() =>
      calculateVetuste({
        lifetimeYears: 0,
        abattementPct: 10,
        equipmentAgeAtEntryYears: 0,
        tenantOccupancyYears: 1,
        repairCostCents: COST,
      }),
    ).toThrow(InvalidVetusteInputError);
  });

  it('weigert een negatieve kost', () => {
    expect(() =>
      calculateVetuste({
        ...PAINT,
        equipmentAgeAtEntryYears: 0,
        tenantOccupancyYears: 1,
        repairCostCents: -1,
      }),
    ).toThrow(InvalidVetusteInputError);
  });

  it('weigert een niet-geheel aantal cent', () => {
    expect(() =>
      calculateVetuste({
        ...PAINT,
        equipmentAgeAtEntryYears: 0,
        tenantOccupancyYears: 1,
        repairCostCents: 100.5,
      }),
    ).toThrow(InvalidVetusteInputError);
  });

  it('weigert een negatieve bewoningsduur', () => {
    expect(() =>
      calculateVetuste({
        ...PAINT,
        equipmentAgeAtEntryYears: 0,
        tenantOccupancyYears: -1,
        repairCostCents: COST,
      }),
    ).toThrow(InvalidVetusteInputError);
  });
});

describe('vetusteApplies', () => {
  it('geldt enkel bij schade', () => {
    expect(vetusteApplies('DAMAGE')).toBe(true);
    expect(vetusteApplies('WEAR_AND_TEAR')).toBe(false);
    expect(vetusteApplies('UNCLEAR')).toBe(false);
  });
});
