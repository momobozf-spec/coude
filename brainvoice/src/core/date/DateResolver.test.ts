import { describe, expect, it } from 'vitest';

import { DateResolver, makeResolveContext, type ResolveContext, type TimePolicy } from './DateResolver';
import type { Language } from '../types/common';

const TZ = 'Europe/Brussels';
// Wednesday 23 September 2026, 10:00 in Brussels (CEST, UTC+2)
const NOW = '2026-09-23T10:00:00';

const resolver = new DateResolver();

function ctx(language: Language, overrides: Partial<{ nowISO: string; timePolicy: TimePolicy; preferFuture: boolean }> = {}): ResolveContext {
  return makeResolveContext({ nowISO: overrides.nowISO ?? NOW, timezone: TZ, language, timePolicy: overrides.timePolicy, preferFuture: overrides.preferFuture });
}

describe('DateResolver – English', () => {
  it('resolves "tomorrow at 8" as 08:00 next day', () => {
    const r = resolver.resolve('tomorrow at 8', ctx('en'));
    expect(r?.date).toBe('2026-09-24');
    expect(r?.time).toBe('08:00');
    expect(r?.hasExplicitTime).toBe(true);
    expect(r?.iso).toBe('2026-09-24T08:00:00+02:00');
  });

  it('resolves "tomorrow morning" with a default morning time that is not explicit', () => {
    const r = resolver.resolve('tomorrow morning', ctx('en'));
    expect(r?.date).toBe('2026-09-24');
    expect(r?.time).toBe('09:00');
    expect(r?.hasExplicitTime).toBe(false);
    expect(r?.dayPart).toBe('morning');
  });

  it('resolves "tomorrow afternoon" and "tonight"', () => {
    expect(resolver.resolve('tomorrow afternoon', ctx('en'))?.time).toBe('14:00');
    const tonight = resolver.resolve('tonight', ctx('en'));
    expect(tonight?.date).toBe('2026-09-23');
    expect(tonight?.dayPart).toBe('evening');
  });

  it('resolves "next Monday" as the Monday of next week', () => {
    const r = resolver.resolve('next Monday at 2', ctx('en'));
    expect(r?.date).toBe('2026-09-28');
    expect(r?.time).toBe('14:00');
  });

  it('resolves "this Friday" and bare "Thursday" as the coming occurrence', () => {
    expect(resolver.resolve('this Friday', ctx('en'))?.date).toBe('2026-09-25');
    expect(resolver.resolve('Thursday', ctx('en'))?.date).toBe('2026-09-24');
  });

  it('treats a bare weekday equal to today as today when the time is still ahead, else next week', () => {
    expect(resolver.resolve('Wednesday at 4', ctx('en'))?.date).toBe('2026-09-23');
    expect(resolver.resolve('Wednesday at 8 am', ctx('en'))?.date).toBe('2026-09-30');
  });

  it('resolves "in two hours" and "in 30 minutes" from now', () => {
    const two = resolver.resolve('in two hours', ctx('en'));
    expect(two?.iso).toBe('2026-09-23T12:00:00+02:00');
    expect(two?.isRelativeOffset).toBe(true);
    const thirty = resolver.resolve('in 30 minutes', ctx('en'));
    expect(thirty?.time).toBe('10:30');
  });

  it('resolves recurrences', () => {
    const monday = resolver.resolve('every Monday at 9', ctx('en'));
    expect(monday?.recurrence).toEqual({ frequency: 'WEEKLY', interval: 1, byWeekday: [1] });
    expect(monday?.date).toBe('2026-09-28');
    expect(monday?.time).toBe('09:00');
    const weekday = resolver.resolve('every weekday at 7', ctx('en', { timePolicy: 'morning' }));
    expect(weekday?.recurrence?.byWeekday).toEqual([1, 2, 3, 4, 5]);
    expect(weekday?.time).toBe('07:00');
  });

  it('resolves "first Monday of next month"', () => {
    expect(resolver.resolve('first Monday of next month', ctx('en'))?.date).toBe('2026-10-05');
  });

  it('resolves "end of the month"', () => {
    expect(resolver.resolve('end of the month', ctx('en'))?.date).toBe('2026-09-30');
  });

  it('resolves quarter/half idioms and "around 4 PM"', () => {
    expect(resolver.resolve('tomorrow at quarter past six', ctx('en', { timePolicy: 'morning' }))?.time).toBe('06:15');
    expect(resolver.resolve('half past seven', ctx('en'))?.time).toBe('07:30');
    expect(resolver.resolve('quarter to eight', ctx('en'))?.time).toBe('07:45');
    expect(resolver.resolve('around 4 PM', ctx('en'))?.time).toBe('16:00');
    expect(resolver.resolve('at 4 pm', ctx('en'))?.time).toBe('16:00');
  });

  it('applies the business policy to ambiguous small hours', () => {
    expect(resolver.resolve('Friday at 2', ctx('en'))?.time).toBe('14:00');
    expect(resolver.resolve('tomorrow at 8', ctx('en'))?.time).toBe('08:00');
    expect(resolver.resolve('tomorrow at 6:30', ctx('en', { timePolicy: 'morning' }))?.time).toBe('06:30');
  });

  it('resolves time ranges with an evening modifier', () => {
    const r = resolver.resolve('Thursday from 7 until 8 in the evening', ctx('en'));
    expect(r?.date).toBe('2026-09-24');
    expect(r?.time).toBe('19:00');
    expect(r?.endTime).toBe('20:00');
    expect(r?.durationMinutes).toBe(60);
  });

  it('resolves durations', () => {
    const r = resolver.resolve('Friday at 2 for one hour', ctx('en'));
    expect(r?.time).toBe('14:00');
    expect(r?.durationMinutes).toBe(60);
    expect(r?.endIso).toBe('2026-09-25T15:00:00+02:00');
    expect(resolver.resolve('for 25 minutes', ctx('en'))?.durationMinutes).toBe(25);
    expect(resolver.resolve('for an hour and a half', ctx('en'))?.durationMinutes).toBe(90);
  });

  it('resolves explicit dates and rolls past dates to next year when preferring the future', () => {
    expect(resolver.resolve('on 25 September', ctx('en'))?.date).toBe('2026-09-25');
    expect(resolver.resolve('September 25th at 14:00', ctx('en'))?.iso).toBe('2026-09-25T14:00:00+02:00');
    expect(resolver.resolve('on 10 September', ctx('en'))?.date).toBe('2027-09-10');
    expect(resolver.resolve('on 10 September', ctx('en', { preferFuture: false }))?.date).toBe('2026-09-10');
    expect(resolver.resolve('25/12', ctx('en'))?.date).toBe('2026-12-25');
    expect(resolver.resolve('01/01/2027', ctx('en'))?.date).toBe('2027-01-01');
  });

  it('resolves "yesterday" and "last week" as ranges for search', () => {
    const y = resolver.resolve('yesterday', ctx('en', { preferFuture: false }));
    expect(y?.date).toBe('2026-09-22');
    expect(y?.isRange).toBe(true);
    const lw = resolver.resolve('last week', ctx('en', { preferFuture: false }));
    expect(lw?.date).toBe('2026-09-14');
    expect(lw?.endDate).toBe('2026-09-20');
  });

  it('extract() returns the text without the date phrases', () => {
    const { resolution, remainingText } = resolver.extract('Remind me tomorrow at 8 to call the accountant', ctx('en'));
    expect(resolution?.iso).toBe('2026-09-24T08:00:00+02:00');
    expect(remainingText).toBe('remind me to call the accountant');
  });

  it('does not treat bare numbers as times', () => {
    const { resolution, remainingText } = resolver.extract('buy 3 apples', ctx('en'));
    expect(resolution).toBeNull();
    expect(remainingText).toBe('buy 3 apples');
  });

  it('resolves noon and midnight', () => {
    expect(resolver.resolve('tomorrow at noon', ctx('en'))?.time).toBe('12:00');
    expect(resolver.resolve('tomorrow at midnight', ctx('en'))?.time).toBe('00:00');
  });
});

describe('DateResolver – Dutch', () => {
  it('resolves "morgen om 8 uur"', () => {
    const r = resolver.resolve('morgen om 8 uur', ctx('nl'));
    expect(r?.iso).toBe('2026-09-24T08:00:00+02:00');
  });

  it('resolves "half zeven" as 06:30 (Dutch idiom)', () => {
    expect(resolver.resolve('morgen om half zeven', ctx('nl', { timePolicy: 'morning' }))?.time).toBe('06:30');
    expect(resolver.resolve('om half 7', ctx('nl', { timePolicy: 'morning' }))?.time).toBe('06:30');
  });

  it('resolves "kwart over zes" and "kwart voor acht"', () => {
    expect(resolver.resolve('kwart over zes', ctx('nl', { timePolicy: 'morning' }))?.time).toBe('06:15');
    expect(resolver.resolve('kwart voor acht', ctx('nl', { timePolicy: 'morning' }))?.time).toBe('07:45');
  });

  it('resolves "donderdag om 14 uur"', () => {
    const r = resolver.resolve('donderdag om 14 uur', ctx('nl'));
    expect(r?.date).toBe('2026-09-24');
    expect(r?.time).toBe('14:00');
  });

  it('resolves compound day parts', () => {
    expect(resolver.resolve('morgenochtend', ctx('nl'))?.date).toBe('2026-09-24');
    expect(resolver.resolve('morgenochtend', ctx('nl'))?.dayPart).toBe('morning');
    expect(resolver.resolve('vanavond om 8 uur', ctx('nl'))?.time).toBe('20:00');
    expect(resolver.resolve('overmorgen', ctx('nl'))?.date).toBe('2026-09-25');
  });

  it('resolves "volgende maandag" and "aanstaande vrijdag"', () => {
    expect(resolver.resolve('volgende maandag', ctx('nl'))?.date).toBe('2026-09-28');
    expect(resolver.resolve('aanstaande vrijdag om 10 uur', ctx('nl'))?.date).toBe('2026-09-25');
  });

  it('resolves "over twee uur" and "over 30 minuten"', () => {
    expect(resolver.resolve('over twee uur', ctx('nl'))?.iso).toBe('2026-09-23T12:00:00+02:00');
    expect(resolver.resolve('over 30 minuten', ctx('nl'))?.time).toBe('10:30');
  });

  it('resolves recurrences and month idioms', () => {
    expect(resolver.resolve('elke maandag om 9 uur', ctx('nl'))?.recurrence?.byWeekday).toEqual([1]);
    expect(resolver.resolve('iedere werkdag', ctx('nl'))?.recurrence?.byWeekday).toEqual([1, 2, 3, 4, 5]);
    expect(resolver.resolve('eerste maandag van volgende maand', ctx('nl'))?.date).toBe('2026-10-05');
    expect(resolver.resolve('einde van de maand', ctx('nl'))?.date).toBe('2026-09-30');
  });

  it('resolves ranges and durations', () => {
    const r = resolver.resolve('donderdag van 7 tot 8 ’s avonds', ctx('nl'));
    expect(r?.time).toBe('19:00');
    expect(r?.endTime).toBe('20:00');
    expect(resolver.resolve('vrijdag om 14 uur van een uur', ctx('nl'))?.durationMinutes).toBe(60);
    expect(resolver.resolve('een timer van 25 minuten', ctx('nl'))?.durationMinutes).toBe(25);
  });

  it('resolves "8u30" and "14u"', () => {
    expect(resolver.resolve('om 8u30', ctx('nl'))?.time).toBe('08:30');
    expect(resolver.resolve('om 14u', ctx('nl'))?.time).toBe('14:00');
  });

  it('extract() strips the Dutch phrase', () => {
    const { remainingText } = resolver.extract('Herinner mij morgen om 8 uur om Yakup te bellen', ctx('nl'));
    expect(remainingText).toBe('herinner mij om yakup te bellen');
  });
});

describe('DateResolver – French', () => {
  it('resolves "demain à 8 heures"', () => {
    expect(resolver.resolve('demain à 8 heures', ctx('fr'))?.iso).toBe('2026-09-24T08:00:00+02:00');
  });

  it('resolves "vendredi à 14h" and "à 14h30"', () => {
    const r = resolver.resolve('vendredi à 14h', ctx('fr'));
    expect(r?.date).toBe('2026-09-25');
    expect(r?.time).toBe('14:00');
    expect(resolver.resolve('à 14h30', ctx('fr'))?.time).toBe('14:30');
  });

  it('resolves French idioms', () => {
    expect(resolver.resolve('à huit heures et quart', ctx('fr', { timePolicy: 'morning' }))?.time).toBe('08:15');
    expect(resolver.resolve('à huit heures et demie', ctx('fr', { timePolicy: 'morning' }))?.time).toBe('08:30');
    expect(resolver.resolve('à huit heures moins le quart', ctx('fr', { timePolicy: 'morning' }))?.time).toBe('07:45');
    expect(resolver.resolve('à midi', ctx('fr'))?.time).toBe('12:00');
    expect(resolver.resolve('à 8 heures du soir', ctx('fr'))?.time).toBe('20:00');
  });

  it('resolves relative and recurring phrases', () => {
    expect(resolver.resolve('dans deux heures', ctx('fr'))?.iso).toBe('2026-09-23T12:00:00+02:00');
    expect(resolver.resolve('dans 30 minutes', ctx('fr'))?.time).toBe('10:30');
    expect(resolver.resolve('ce soir', ctx('fr'))?.dayPart).toBe('evening');
    expect(resolver.resolve('demain matin', ctx('fr'))?.time).toBe('09:00');
    expect(resolver.resolve('lundi prochain', ctx('fr'))?.date).toBe('2026-09-28');
    expect(resolver.resolve('tous les lundis à 9h', ctx('fr'))?.recurrence?.byWeekday).toEqual([1]);
    expect(resolver.resolve('chaque jour', ctx('fr'))?.recurrence?.frequency).toBe('DAILY');
    expect(resolver.resolve('premier lundi du mois prochain', ctx('fr'))?.date).toBe('2026-10-05');
    expect(resolver.resolve('fin du mois', ctx('fr'))?.date).toBe('2026-09-30');
    expect(resolver.resolve('la semaine prochaine', ctx('fr'))?.date).toBe('2026-09-28');
  });

  it('resolves ranges and durations', () => {
    const r = resolver.resolve('jeudi de 19h à 20h', ctx('fr'));
    expect(r?.time).toBe('19:00');
    expect(r?.endTime).toBe('20:00');
    expect(resolver.resolve("vendredi à 14h pendant une heure", ctx('fr'))?.durationMinutes).toBe(60);
    expect(resolver.resolve('un minuteur de 25 minutes', ctx('fr'))?.durationMinutes).toBe(25);
  });

  it('extract() strips the French phrase', () => {
    const { remainingText } = resolver.extract("Rappelle-moi demain à 8 heures d'appeler Yakup", ctx('fr'));
    expect(remainingText).toBe("rappelle-moi d'appeler yakup");
  });
});

describe('DateResolver – timezone, DST and boundaries', () => {
  it('handles the spring DST transition (2026-03-29 in Brussels)', () => {
    const c = ctx('en', { nowISO: '2026-03-28T23:30:00' });
    const r = resolver.resolve('in two hours', c);
    // 23:30 CET + 2h = 01:30 CET is still before the jump; offset stays +01:00
    expect(r?.iso).toBe('2026-03-29T01:30:00+01:00');
    const later = resolver.resolve('in three hours', c);
    // 02:30 local does not exist → 03:30 CEST
    expect(later?.iso).toBe('2026-03-29T03:30:00+02:00');
  });

  it('handles the autumn DST transition (2026-10-25 in Brussels)', () => {
    const c = ctx('en', { nowISO: '2026-10-24T12:00:00' });
    const r = resolver.resolve('tomorrow at 8', c);
    expect(r?.iso).toBe('2026-10-25T08:00:00+01:00');
    const dayAfter = resolver.resolve('in 24 hours', c);
    // 24 elapsed hours after 12:00 CEST is 11:00 CET
    expect(dayAfter?.iso).toBe('2026-10-25T11:00:00+01:00');
  });

  it('crosses month and year boundaries', () => {
    expect(resolver.resolve('tomorrow', ctx('en', { nowISO: '2026-09-30T09:00:00' }))?.date).toBe('2026-10-01');
    expect(resolver.resolve('tomorrow', ctx('en', { nowISO: '2026-12-31T09:00:00' }))?.date).toBe('2027-01-01');
    expect(resolver.resolve('end of the month', ctx('en', { nowISO: '2026-02-10T09:00:00' }))?.date).toBe('2026-02-28');
    expect(resolver.resolve('next Monday', ctx('en', { nowISO: '2026-12-30T09:00:00' }))?.date).toBe('2027-01-04');
  });

  it('handles midnight and end-of-day edge cases', () => {
    const c = ctx('en', { nowISO: '2026-09-23T00:00:00' });
    expect(resolver.resolve('tonight at 11', c)?.iso).toBe('2026-09-23T23:00:00+02:00');
    const lateCtx = ctx('en', { nowISO: '2026-09-23T23:59:00' });
    // "at 8" said at 23:59 → tomorrow
    expect(resolver.resolve('at 8', lateCtx)?.date).toBe('2026-09-24');
  });

  it('"next Monday" when today is Sunday gives tomorrow', () => {
    expect(resolver.resolve('next Monday', ctx('en', { nowISO: '2026-09-27T09:00:00' }))?.date).toBe('2026-09-28');
  });

  it('"next Monday" when today is Monday gives next week', () => {
    expect(resolver.resolve('next Monday', ctx('en', { nowISO: '2026-09-21T09:00:00' }))?.date).toBe('2026-09-28');
  });

  it('respects a non-European timezone', () => {
    const c = makeResolveContext({ nowISO: '2026-09-23T10:00:00', timezone: 'America/New_York', language: 'en' });
    expect(resolver.resolve('tomorrow at 8', c)?.iso).toBe('2026-09-24T08:00:00-04:00');
  });
});
