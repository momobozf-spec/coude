import { RecurrenceAnchor, RecurrenceFreq, WORKDAYS, type RecurrenceRule } from '@orbit/types';
import { describe, expect, it } from 'vitest';
import {
  RECURRENCE_PRESETS,
  describeRecurrence,
  iterateOccurrences,
  nextOccurrenceAfterCompletion,
  nextScheduledOccurrence,
  occurrencesInRange,
} from '../src/recurrence/engine';

function take(rule: RecurrenceRule, start: string, count: number): string[] {
  const results: string[] = [];
  for (const date of iterateOccurrences(rule, start)) {
    results.push(date);
    if (results.length >= count) break;
  }
  return results;
}

const schedule = RecurrenceAnchor.Schedule;

describe('dagelijkse herhaling', () => {
  it('loopt per dag door', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Daily, interval: 1, anchor: schedule };
    expect(take(rule, '2026-08-25', 3)).toEqual(['2026-08-25', '2026-08-26', '2026-08-27']);
  });

  it('respecteert een interval', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Daily, interval: 3, anchor: schedule };
    expect(take(rule, '2026-08-25', 3)).toEqual(['2026-08-25', '2026-08-28', '2026-08-31']);
  });

  it('stopt na het opgegeven aantal', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Daily, interval: 1, count: 3, anchor: schedule };
    expect([...iterateOccurrences(rule, '2026-08-25')]).toHaveLength(3);
  });

  it('stopt op de einddatum', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Daily,
      interval: 1,
      until: '2026-08-27',
      anchor: schedule,
    };
    expect([...iterateOccurrences(rule, '2026-08-25')]).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
    ]);
  });
});

describe('wekelijkse herhaling', () => {
  it('herhaalt op dezelfde weekdag als de startdatum', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Weekly, interval: 1, anchor: schedule };
    // 2026-08-25 is een dinsdag.
    expect(take(rule, '2026-08-25', 3)).toEqual(['2026-08-25', '2026-09-01', '2026-09-08']);
  });

  it('ondersteunt meerdere weekdagen', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Weekly,
      interval: 1,
      byWeekday: ['MO', 'TH'],
      anchor: schedule,
    };
    expect(take(rule, '2026-08-25', 4)).toEqual([
      '2026-08-27', // donderdag
      '2026-08-31', // maandag
      '2026-09-03',
      '2026-09-07',
    ]);
  });

  it('slaat weken over bij een interval', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Weekly,
      interval: 2,
      byWeekday: ['MO'],
      anchor: schedule,
    };
    expect(take(rule, '2026-08-24', 3)).toEqual(['2026-08-24', '2026-09-07', '2026-09-21']);
  });

  it('doet elke werkdag', () => {
    const rule = RECURRENCE_PRESETS.weekdays();
    expect(rule.byWeekday).toEqual([...WORKDAYS]);
    // Start op vrijdag 2026-08-28: daarna maandag, niet zaterdag.
    expect(take(rule, '2026-08-28', 3)).toEqual(['2026-08-28', '2026-08-31', '2026-09-01']);
  });
});

describe('maandelijkse herhaling', () => {
  it('houdt de dag van de maand aan', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Monthly, interval: 1, anchor: schedule };
    expect(take(rule, '2026-01-15', 3)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('slaat maanden over waarin de dag niet bestaat', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Monthly,
      interval: 1,
      byMonthDay: [31],
      anchor: schedule,
    };
    // Februari, april, juni en september hebben geen 31e.
    expect(take(rule, '2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
      '2026-07-31',
    ]);
  });

  it('begrijpt de laatste dag van de maand', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Monthly,
      interval: 1,
      byMonthDay: [-1],
      anchor: schedule,
    };
    expect(take(rule, '2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('jaarlijkse herhaling', () => {
  it('herhaalt op dezelfde datum', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Yearly, interval: 1, anchor: schedule };
    expect(take(rule, '2026-03-10', 3)).toEqual(['2026-03-10', '2027-03-10', '2028-03-10']);
  });

  it('slaat 29 februari over in niet-schrikkeljaren', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Yearly, interval: 1, anchor: schedule };
    expect(take(rule, '2028-02-29', 2)).toEqual(['2028-02-29', '2032-02-29']);
  });
});

describe('afvinken van een herhalende taak', () => {
  it('schuift naar het volgende geplande moment', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Daily, interval: 1, anchor: schedule };
    expect(nextOccurrenceAfterCompletion(rule, '2026-08-25', '2026-08-25')).toBe('2026-08-26');
  });

  it('slaat gemiste voorkomens over in plaats van ze op te stapelen', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Daily, interval: 1, anchor: schedule };
    // Taak stond op 20 augustus, wordt pas op 25 augustus afgevinkt.
    expect(nextOccurrenceAfterCompletion(rule, '2026-08-20', '2026-08-25')).toBe('2026-08-26');
  });

  it('telt bij het afvink-anker vanaf het afvinkmoment', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Daily,
      interval: 3,
      anchor: RecurrenceAnchor.Completion,
    };
    expect(nextOccurrenceAfterCompletion(rule, '2026-08-20', '2026-08-25')).toBe('2026-08-28');
  });

  it('geeft null als de reeks voorbij is', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Daily,
      interval: 1,
      until: '2026-08-25',
      anchor: schedule,
    };
    expect(nextOccurrenceAfterCompletion(rule, '2026-08-25', '2026-08-25')).toBeNull();
  });
});

describe('kalenderweergave', () => {
  it('geeft alleen de voorkomens binnen het venster', () => {
    const rule: RecurrenceRule = { freq: RecurrenceFreq.Weekly, interval: 1, anchor: schedule };
    expect(occurrencesInRange(rule, '2026-08-04', '2026-09-01', '2026-09-20')).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ]);
  });

  it('geeft het eerstvolgende moment na een datum', () => {
    const rule: RecurrenceRule = {
      freq: RecurrenceFreq.Weekly,
      interval: 1,
      byWeekday: ['MO'],
      anchor: schedule,
    };
    expect(nextScheduledOccurrence(rule, '2026-08-24', '2026-08-25')).toBe('2026-08-31');
  });
});

describe('omschrijvingen', () => {
  it('beschrijft regels in het Nederlands', () => {
    expect(describeRecurrence(RECURRENCE_PRESETS.daily())).toBe('elke dag');
    expect(describeRecurrence(RECURRENCE_PRESETS.weekdays())).toBe('elke werkdag');
    expect(
      describeRecurrence({
        freq: RecurrenceFreq.Weekly,
        interval: 2,
        byWeekday: ['MO', 'TH'],
        anchor: schedule,
      }),
    ).toBe('elke 2 weken op maandag en donderdag');
    expect(
      describeRecurrence({
        freq: RecurrenceFreq.Daily,
        interval: 3,
        anchor: RecurrenceAnchor.Completion,
      }),
    ).toBe('elke 3 dagen na afvinken');
  });

  it('beschrijft regels in het Engels', () => {
    expect(describeRecurrence(RECURRENCE_PRESETS.weekdays(), 'en')).toBe('every weekday');
    expect(describeRecurrence(RECURRENCE_PRESETS.monthly(), 'en')).toBe('every month');
  });
});
