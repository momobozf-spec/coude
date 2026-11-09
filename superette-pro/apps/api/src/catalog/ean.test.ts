import { describe, expect, it } from 'vitest';
import { completeEan, isValidEan } from './ean';

describe('isValidEan', () => {
  it('accepteert echte EAN-13 codes', () => {
    // Bekende, echt bestaande streepjescodes.
    expect(isValidEan('4006381333931')).toBe(true); // Staedtler
    expect(isValidEan('5449000000996')).toBe(true); // Coca-Cola BE
    expect(isValidEan('9780201379624')).toBe(true); // ISBN-13
  });

  it('accepteert een geldige EAN-8', () => {
    expect(isValidEan('96385074')).toBe(true);
  });

  it('verwerpt een fout controlecijfer', () => {
    // Coca-Cola met het laatste cijfer één omhoog.
    expect(isValidEan('5449000000997')).toBe(false);
  });

  it('vangt elk enkelvoudig verkeerd gelezen cijfer', () => {
    // Dit is de eigenschap waar het om draait: de camera leest één cijfer fout,
    // en de checksum moet dat altijd zien.
    const valid = '5449000000996';

    for (let position = 0; position < valid.length; position++) {
      for (let replacement = 0; replacement <= 9; replacement++) {
        if (Number(valid[position]) === replacement) continue;

        const corrupted = `${valid.slice(0, position)}${replacement}${valid.slice(position + 1)}`;
        expect(isValidEan(corrupted), `${corrupted} had afgewezen moeten worden`).toBe(false);
      }
    }
  });

  it('verwerpt verkeerde lengtes en niet-cijfers', () => {
    expect(isValidEan('')).toBe(false);
    expect(isValidEan('544900000099')).toBe(false); // 12 cijfers
    expect(isValidEan('54490000009966')).toBe(false); // 14 cijfers
    expect(isValidEan('544900000099X')).toBe(false);
    expect(isValidEan('  5449000000996  ')).toBe(false);
  });
});

describe('completeEan', () => {
  it('vult het controlecijfer aan voor EAN-13', () => {
    expect(completeEan('544900000099')).toBe('5449000000996');
  });

  it('vult het controlecijfer aan voor EAN-8', () => {
    expect(completeEan('9638507')).toBe('96385074');
  });

  it('produceert altijd een geldige EAN', () => {
    for (let n = 0; n < 500; n++) {
      const body = String(541234500000 + n).padStart(12, '0');
      expect(isValidEan(completeEan(body))).toBe(true);
    }
  });

  it('weigert een verkeerde lengte', () => {
    expect(() => completeEan('12345')).toThrow(RangeError);
  });
});
