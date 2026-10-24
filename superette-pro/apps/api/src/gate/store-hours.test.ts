import { describe, expect, it } from 'vitest';
import { isStoreOpenAt, isWithinOpeningHours, minutesSinceMidnightInBrussels } from './store-hours';

describe('minutesSinceMidnightInBrussels', () => {
  it('rekent winteruur om (UTC+1)', () => {
    // 08:00 UTC in januari = 09:00 in Brussel.
    expect(minutesSinceMidnightInBrussels(new Date('2026-01-15T08:00:00Z'))).toBe(9 * 60);
  });

  it('rekent zomeruur om (UTC+2)', () => {
    // 08:00 UTC in juli = 10:00 in Brussel. Dit is het uur dat je verliest als
    // je een vaste offset hardcodeert.
    expect(minutesSinceMidnightInBrussels(new Date('2026-07-15T08:00:00Z'))).toBe(10 * 60);
  });

  it('geeft middernacht terug als 0, niet als 1440', () => {
    // 23:00 UTC in januari = 00:00 in Brussel. Intl kan hier "24" teruggeven.
    expect(minutesSinceMidnightInBrussels(new Date('2026-01-15T23:00:00Z'))).toBe(0);
  });

  it('werkt op de dag van de tijdswissel', () => {
    // Op 29 maart 2026 springt Brussel om 02:00 naar 03:00.
    expect(minutesSinceMidnightInBrussels(new Date('2026-03-29T00:59:00Z'))).toBe(1 * 60 + 59); // nog UTC+1
    expect(minutesSinceMidnightInBrussels(new Date('2026-03-29T01:00:00Z'))).toBe(3 * 60); // nu UTC+2
  });
});

describe('isWithinOpeningHours', () => {
  const dagwinkel = { opensAtMinute: 6 * 60, closesAtMinute: 23 * 60 }; // 06:00 – 23:00

  it('is open midden op de dag', () => {
    expect(isWithinOpeningHours(12 * 60, dagwinkel)).toBe(true);
  });

  it('is open op het openingsmoment zelf', () => {
    expect(isWithinOpeningHours(6 * 60, dagwinkel)).toBe(true);
  });

  it('is dicht op het sluitingsmoment zelf', () => {
    // Half-open venster: om 23:00 sharp gaat de deur niet meer open.
    expect(isWithinOpeningHours(23 * 60, dagwinkel)).toBe(false);
  });

  it('is dicht een minuut voor opening', () => {
    expect(isWithinOpeningHours(6 * 60 - 1, dagwinkel)).toBe(false);
  });

  it('is dicht in het holst van de nacht', () => {
    expect(isWithinOpeningHours(3 * 60, dagwinkel)).toBe(false);
  });

  describe('venster over middernacht (22:00 – 02:00)', () => {
    const nachtwinkel = { opensAtMinute: 22 * 60, closesAtMinute: 2 * 60 };

    it('is open vlak na opening', () => {
      expect(isWithinOpeningHours(22 * 60 + 30, nachtwinkel)).toBe(true);
    });

    it('is open om middernacht', () => {
      expect(isWithinOpeningHours(0, nachtwinkel)).toBe(true);
    });

    it('is open vlak voor sluiting', () => {
      expect(isWithinOpeningHours(1 * 60 + 59, nachtwinkel)).toBe(true);
    });

    it('is dicht na sluiting', () => {
      expect(isWithinOpeningHours(2 * 60, nachtwinkel)).toBe(false);
      expect(isWithinOpeningHours(12 * 60, nachtwinkel)).toBe(false);
    });
  });

  it('behandelt gelijke tijden als 24/7 open', () => {
    const altijdOpen = { opensAtMinute: 0, closesAtMinute: 0 };
    expect(isWithinOpeningHours(0, altijdOpen)).toBe(true);
    expect(isWithinOpeningHours(3 * 60, altijdOpen)).toBe(true);
    expect(isWithinOpeningHours(1439, altijdOpen)).toBe(true);
  });

  it('weigert onmogelijke minuutwaarden', () => {
    expect(() => isWithinOpeningHours(1440, dagwinkel)).toThrow(RangeError);
    expect(() => isWithinOpeningHours(-1, dagwinkel)).toThrow(RangeError);
    expect(() => isWithinOpeningHours(12 * 60, { opensAtMinute: 0, closesAtMinute: 9999 })).toThrow(RangeError);
  });
});

describe('isStoreOpenAt', () => {
  const dagwinkel = { opensAtMinute: 6 * 60, closesAtMinute: 23 * 60 };

  it('gebruikt Brusselse tijd, niet UTC', () => {
    // 22:30 UTC in juli = 00:30 in Brussel → dicht.
    // Wie op UTC vergelijkt, zou hier de deur openen.
    expect(isStoreOpenAt(new Date('2026-07-15T22:30:00Z'), dagwinkel)).toBe(false);

    // 05:30 UTC in juli = 07:30 in Brussel → open.
    // Wie op UTC vergelijkt, zou hier een klant buiten laten staan.
    expect(isStoreOpenAt(new Date('2026-07-15T05:30:00Z'), dagwinkel)).toBe(true);
  });
});
