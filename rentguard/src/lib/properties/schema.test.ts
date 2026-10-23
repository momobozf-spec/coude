import { describe, expect, it } from 'vitest';

import {
  isBrusselsPostalCode,
  municipalityFor,
  municipalityOptions,
} from '@/lib/properties/brussels';
import { depositExceedsTwoMonths, propertySchema } from '@/lib/properties/schema';

const MINIMAL = {
  address: 'Wetstraat 16',
  postalCode: '1000',
  municipality: 'Brussel',
  monthlyRent: '',
  monthlyCharges: '',
  depositAmount: '',
  depositType: 'UNKNOWN',
  leaseSignedOn: '',
  leaseStart: '',
  leaseEnd: '',
  leaseRegistered: '',
  pebCertificateProvided: '',
  pebRating: '',
  surfaceM2: '',
  bedrooms: '',
  landlordName: '',
  landlordAddress: '',
  landlordEmail: '',
  retentionYears: '2',
};

describe('isBrusselsPostalCode', () => {
  it('aanvaardt Brusselse postcodes', () => {
    for (const code of ['1000', '1050', '1180', '1210', '1299']) {
      expect(isBrusselsPostalCode(code), code).toBe(true);
    }
  });

  it('weigert postcodes buiten het Gewest', () => {
    for (const code of ['0999', '1300', '2000', '4000', '9000']) {
      expect(isBrusselsPostalCode(code), code).toBe(false);
    }
  });

  it('weigert alles wat geen viercijferige postcode is', () => {
    for (const value of ['', '100', '10000', 'abcd', '1 000']) {
      expect(isBrusselsPostalCode(value), value).toBe(false);
    }
  });
});

describe('municipalityFor', () => {
  it('geeft de gemeente in de juiste taal', () => {
    expect(municipalityFor('1050', 'nl')).toBe('Elsene');
    expect(municipalityFor('1050', 'fr')).toBe('Ixelles');
    expect(municipalityFor('1180', 'nl')).toBe('Ukkel');
    expect(municipalityFor('1180', 'fr')).toBe('Uccle');
  });

  it('geeft null bij een postcode die niet in de lijst staat', () => {
    expect(municipalityFor('1299', 'nl')).toBeNull();
  });

  it('levert een gesorteerde lijst zonder duplicaten', () => {
    const options = municipalityOptions('fr');
    expect(new Set(options).size).toBe(options.length);
    expect(options).toContain('Ixelles');
    expect(options).toContain('Schaerbeek');
  });
});

describe('propertySchema', () => {
  it('aanvaardt het minimum', () => {
    const result = propertySchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.monthlyRent).toBeNull();
      expect(result.data.retentionYears).toBe(2);
    }
  });

  it('weigert een postcode buiten Brussel met een eigen code', () => {
    const result = propertySchema.safeParse({ ...MINIMAL, postalCode: '9000' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === 'NOT_BRUSSELS'),
      ).toBe(true);
    }
  });

  it('leest bedragen met een komma als decimaalteken', () => {
    const result = propertySchema.safeParse({
      ...MINIMAL,
      monthlyRent: '1 250,50',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.monthlyRent).toBe(1250.5);
  });

  it('weigert een einddatum vóór de begindatum', () => {
    const result = propertySchema.safeParse({
      ...MINIMAL,
      leaseStart: '2026-01-01',
      leaseEnd: '2025-12-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === 'END_BEFORE_START'),
      ).toBe(true);
    }
  });

  it('weigert een ondertekening na de aanvang van de huur', () => {
    const result = propertySchema.safeParse({
      ...MINIMAL,
      leaseSignedOn: '2026-03-01',
      leaseStart: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === 'SIGNED_AFTER_START'),
      ).toBe(true);
    }
  });

  it('vertaalt ja/nee/onbekend naar boolean of null', () => {
    const yes = propertySchema.safeParse({ ...MINIMAL, leaseRegistered: 'yes' });
    const no = propertySchema.safeParse({ ...MINIMAL, leaseRegistered: 'no' });
    const unknown = propertySchema.safeParse({
      ...MINIMAL,
      leaseRegistered: 'unknown',
    });

    expect(yes.success && yes.data.leaseRegistered).toBe(true);
    expect(no.success && no.data.leaseRegistered).toBe(false);
    expect(unknown.success && unknown.data.leaseRegistered).toBeNull();
  });

  it('begrenst de bewaartermijn tot tien jaar', () => {
    expect(
      propertySchema.safeParse({ ...MINIMAL, retentionYears: '11' }).success,
    ).toBe(false);
    expect(
      propertySchema.safeParse({ ...MINIMAL, retentionYears: '10' }).success,
    ).toBe(true);
  });

  it('maakt een leeg e-mailadres null in plaats van een fout', () => {
    const result = propertySchema.safeParse({ ...MINIMAL, landlordEmail: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.landlordEmail).toBeNull();
  });
});

describe('depositExceedsTwoMonths', () => {
  it('signaleert een waarborg van drie maanden', () => {
    expect(depositExceedsTwoMonths(800, 2400)).toBe(true);
  });

  it('signaleert niets bij precies twee maanden', () => {
    expect(depositExceedsTwoMonths(800, 1600)).toBe(false);
  });

  it('laat een kleine afrondingsmarge toe', () => {
    expect(depositExceedsTwoMonths(800, 1610)).toBe(false);
  });

  it('signaleert niets bij ontbrekende gegevens', () => {
    expect(depositExceedsTwoMonths(null, 2400)).toBe(false);
    expect(depositExceedsTwoMonths(800, null)).toBe(false);
    expect(depositExceedsTwoMonths(0, 2400)).toBe(false);
  });
});
