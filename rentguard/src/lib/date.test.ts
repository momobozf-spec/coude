import { describe, expect, it } from 'vitest';

import {
  addMonthsUtc,
  commencedMonthsBetween,
  daysBetween,
  parseIsoDate,
  startOfUtcDay,
  toIsoDate,
} from '@/lib/date';

const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('addMonthsUtc', () => {
  it('telt gewone maanden op', () => {
    expect(iso(addMonthsUtc(new Date('2026-03-15T00:00:00Z'), 2))).toBe(
      '2026-05-15',
    );
  });

  it('klemt op de laatste dag van een kortere maand', () => {
    expect(iso(addMonthsUtc(new Date('2025-12-31T00:00:00Z'), 2))).toBe(
      '2026-02-28',
    );
    expect(iso(addMonthsUtc(new Date('2026-01-31T00:00:00Z'), 1))).toBe(
      '2026-02-28',
    );
  });

  it('klemt ook bij aftrekken', () => {
    // 29 augustus min zes maanden mag niet op 1 maart uitkomen.
    expect(iso(addMonthsUtc(new Date('2026-08-29T12:00:00Z'), -6))).toBe(
      '2026-02-28',
    );
  });

  it('houdt rekening met schrikkeljaren', () => {
    expect(iso(addMonthsUtc(new Date('2024-01-31T00:00:00Z'), 1))).toBe(
      '2024-02-29',
    );
  });

  it('rekent over een jaargrens heen', () => {
    expect(iso(addMonthsUtc(new Date('2026-11-15T00:00:00Z'), 3))).toBe(
      '2027-02-15',
    );
    expect(iso(addMonthsUtc(new Date('2026-02-15T00:00:00Z'), -3))).toBe(
      '2025-11-15',
    );
  });

  it('negeert het tijdstip', () => {
    expect(iso(addMonthsUtc(new Date('2026-03-15T23:59:59Z'), 1))).toBe(
      '2026-04-15',
    );
  });
});

describe('startOfUtcDay', () => {
  it('zet de tijd op middernacht UTC', () => {
    expect(startOfUtcDay(new Date('2026-03-15T18:30:00Z')).toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    );
  });
});

describe('daysBetween', () => {
  it('telt hele dagen', () => {
    expect(
      daysBetween(new Date('2026-03-01T00:00:00Z'), new Date('2026-03-15T00:00:00Z')),
    ).toBe(14);
  });

  it('is ongevoelig voor het tijdstip', () => {
    expect(
      daysBetween(new Date('2026-03-01T23:00:00Z'), new Date('2026-03-02T01:00:00Z')),
    ).toBe(1);
  });

  it('geeft een negatief getal voor een datum in het verleden', () => {
    expect(
      daysBetween(new Date('2026-03-15T00:00:00Z'), new Date('2026-03-01T00:00:00Z')),
    ).toBe(-14);
  });
});

describe('commencedMonthsBetween', () => {
  it('telt één dag te laat als één maand', () => {
    expect(
      commencedMonthsBetween(
        new Date('2026-03-10T00:00:00Z'),
        new Date('2026-03-11T00:00:00Z'),
      ),
    ).toBe(1);
  });

  it('telt nul wanneer de datum nog niet bereikt is', () => {
    expect(
      commencedMonthsBetween(
        new Date('2026-03-10T00:00:00Z'),
        new Date('2026-03-10T00:00:00Z'),
      ),
    ).toBe(0);
  });

  it('telt een volle maand plus een begonnen maand', () => {
    expect(
      commencedMonthsBetween(
        new Date('2026-01-10T00:00:00Z'),
        new Date('2026-02-15T00:00:00Z'),
      ),
    ).toBe(2);
  });

  it('telt exact twee maanden als twee', () => {
    expect(
      commencedMonthsBetween(
        new Date('2026-01-10T00:00:00Z'),
        new Date('2026-03-10T00:00:00Z'),
      ),
    ).toBe(3);
  });
});

describe('parseIsoDate en toIsoDate', () => {
  it('leest een ISO-datum als middernacht UTC', () => {
    expect(parseIsoDate('2026-03-15')?.toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    );
  });

  it('geeft null bij ontbrekende of onleesbare invoer', () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('geen datum')).toBeNull();
  });

  it('schrijft terug naar ISO', () => {
    expect(toIsoDate(new Date('2026-03-15T18:00:00Z'))).toBe('2026-03-15');
  });
});
