import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  describeRelativeDate,
  differenceInDays,
  eachDayInRange,
  endOfMonth,
  isValidIsoDate,
  isValidIsoTime,
  startOfWeek,
  todayInTimeZone,
  utcToZonedDate,
  zonedDateTimeToUtc,
} from '../src/dates';

describe('datumrekenen', () => {
  it('telt dagen op over een maandgrens', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('houdt rekening met schrikkeljaren', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });

  it('klemt de dag vast bij het optellen van maanden', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('berekent het verschil in dagen', () => {
    expect(differenceInDays('2026-08-25', '2026-08-30')).toBe(5);
    expect(differenceInDays('2026-08-30', '2026-08-25')).toBe(-5);
    expect(differenceInDays('2026-08-25', '2026-08-25')).toBe(0);
  });

  it('bepaalt het begin van de week met maandag als eerste dag', () => {
    // 2026-08-25 is een dinsdag.
    expect(startOfWeek('2026-08-25', 1)).toBe('2026-08-24');
    expect(startOfWeek('2026-08-25', 0)).toBe('2026-08-23');
    expect(startOfWeek('2026-08-24', 1)).toBe('2026-08-24');
  });

  it('valideert datums en tijden', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoTime('24:00')).toBe(false);
    expect(isValidIsoTime('23:59')).toBe(true);
  });

  it('geeft alle dagen in een bereik terug', () => {
    expect(eachDayInRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });
});

describe('tijdzones', () => {
  it('zet lokale tijd om naar UTC in de zomertijd', () => {
    // Brussel is in augustus UTC+2.
    expect(zonedDateTimeToUtc('2026-08-25', '14:00', 'Europe/Brussels')).toBe(
      '2026-08-25T12:00:00.000Z',
    );
  });

  it('zet lokale tijd om naar UTC in de wintertijd', () => {
    // Brussel is in januari UTC+1.
    expect(zonedDateTimeToUtc('2026-01-15', '14:00', 'Europe/Brussels')).toBe(
      '2026-01-15T13:00:00.000Z',
    );
  });

  it('overleeft de overgang naar zomertijd', () => {
    // 29 maart 2026 om 02:00 springt de klok naar 03:00 in Brussel.
    const result = zonedDateTimeToUtc('2026-03-29', '03:30', 'Europe/Brussels');
    expect(result).toBe('2026-03-29T01:30:00.000Z');
  });

  it('bepaalt de lokale kalenderdag over de datumgrens heen', () => {
    // 23:30 UTC is in Brussel al de volgende dag.
    const instant = new Date('2026-08-25T23:30:00.000Z');
    expect(todayInTimeZone(instant, 'Europe/Brussels')).toBe('2026-08-26');
    expect(todayInTimeZone(instant, 'UTC')).toBe('2026-08-25');
    expect(todayInTimeZone(instant, 'America/New_York')).toBe('2026-08-25');
  });

  it('is rond bij heen- en terugrekenen', () => {
    const utc = zonedDateTimeToUtc('2026-11-03', '08:15', 'Asia/Tokyo');
    expect(utcToZonedDate(utc, 'Asia/Tokyo')).toBe('2026-11-03');
  });
});

describe('relatieve labels', () => {
  it('benoemt vandaag, morgen en achterstallig', () => {
    expect(describeRelativeDate('2026-08-25', '2026-08-25').key).toBe('today');
    expect(describeRelativeDate('2026-08-26', '2026-08-25').key).toBe('tomorrow');
    expect(describeRelativeDate('2026-08-24', '2026-08-25').key).toBe('yesterday');
    expect(describeRelativeDate('2026-08-20', '2026-08-25').key).toBe('overdue');
    expect(describeRelativeDate('2026-08-29', '2026-08-25').key).toBe('thisWeek');
    expect(describeRelativeDate('2026-10-01', '2026-08-25').key).toBe('date');
  });
});
