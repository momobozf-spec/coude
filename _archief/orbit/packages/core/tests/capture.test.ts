import { ItemType, Priority, RecurrenceFreq, type CaptureContext } from '@orbit/types';
import { describe, expect, it } from 'vitest';
import { parseQuickCapture } from '../src/capture/parser';

// Dinsdag 25 augustus 2026, 10:00 in Brussel.
const NOW = new Date('2026-08-25T08:00:00.000Z');

const ctx: CaptureContext = {
  now: NOW,
  timeZone: 'Europe/Brussels',
  locale: 'nl',
  weekStartsOn: 1,
};

describe('quick capture, het voorbeeld uit de opdracht', () => {
  it('haalt taak, datum en tijd uit een gewone zin', () => {
    const result = parseQuickCapture('Bel morgen om 14:00 met boekhouder', ctx);
    expect(result.title).toBe('Bel met boekhouder');
    expect(result.dueDate).toBe('2026-08-26');
    expect(result.dueTime).toBe('14:00');
    expect(result.type).toBe(ItemType.Task);
    expect(result.tokens.map((token) => token.kind)).toEqual(['DATE', 'TIME']);
  });
});

describe('datums', () => {
  it.each([
    ['Vandaag rapport afwerken', '2026-08-25'],
    ['Morgen factuur versturen', '2026-08-26'],
    ['Overmorgen klant bellen', '2026-08-27'],
    ['Offerte over 3 dagen nakijken', '2026-08-28'],
    ['Planning over 2 weken maken', '2026-09-08'],
    ['Rapport op 3 september afronden', '2026-09-03'],
    ['Deadline 15/09 halen', '2026-09-15'],
    ['Afspraak 15-09-2026 bevestigen', '2026-09-15'],
    ['Vrijdag boodschappen doen', '2026-08-28'],
    ['Betaling eind van de maand', '2026-08-31'],
  ])('%s', (input, expected) => {
    expect(parseQuickCapture(input, ctx).dueDate).toBe(expected);
  });

  it('kiest volgende week als de dag deze week al voorbij is', () => {
    // Vandaag is dinsdag; maandag is dus pas volgende week.
    expect(parseQuickCapture('Maandag team bellen', ctx).dueDate).toBe('2026-08-31');
  });

  it('gebruikt vandaag als de weekdag vandaag is', () => {
    expect(parseQuickCapture('Dinsdag rapport', ctx).dueDate).toBe('2026-08-25');
  });

  it('schuift door met aanstaande', () => {
    expect(parseQuickCapture('Aanstaande dinsdag rapport', ctx).dueDate).toBe('2026-09-01');
  });

  it('rolt door naar volgend jaar bij een datum die al voorbij is', () => {
    expect(parseQuickCapture('Verjaardag 10 maart vieren', ctx).dueDate).toBe('2027-03-10');
  });
});

describe('tijden', () => {
  it.each([
    ['Bel om 9:30', '09:30'],
    ['Meeting om 14 uur', '14:00'],
    ['Standup 09:15', '09:15'],
    ['Call at 3pm', '15:00'],
  ])('%s', (input, expected) => {
    expect(parseQuickCapture(input, ctx).dueTime).toBe(expected);
  });

  it('zet vanavond om naar vandaag 20:00', () => {
    const result = parseQuickCapture('Vanavond sporten', ctx);
    expect(result.dueTime).toBe('20:00');
    expect(result.dueDate).toBe('2026-08-25');
  });

  it('vult de datum aan als er alleen een tijd staat', () => {
    expect(parseQuickCapture('Bel om 16:00', ctx).dueDate).toBe('2026-08-25');
  });
});

describe('prioriteit, tags en project', () => {
  it('leest p1 als urgent', () => {
    const result = parseQuickCapture('Server herstarten p1', ctx);
    expect(result.priority).toBe(Priority.Urgent);
    expect(result.title).toBe('Server herstarten');
  });

  it('leest het woord urgent', () => {
    expect(parseQuickCapture('Urgent factuur betalen', ctx).priority).toBe(Priority.Urgent);
  });

  it('haalt tags en projecten uit de tekst', () => {
    const result = parseQuickCapture('Domeinnaam kopen #webshop @business @finance', ctx);
    expect(result.projectName).toBe('webshop');
    expect(result.tagNames).toEqual(['business', 'finance']);
    expect(result.title).toBe('Domeinnaam kopen');
  });

  it('leest een tijdsinschatting', () => {
    expect(parseQuickCapture('Rapport schrijven 45 min', ctx).estimateMinutes).toBe(45);
    expect(parseQuickCapture('Deep work 2 uur', ctx).estimateMinutes).toBe(120);
  });
});

describe('herhaling', () => {
  it('herkent elke werkdag', () => {
    const result = parseQuickCapture('Elke werkdag inbox opruimen', ctx);
    expect(result.recurrence).toMatchObject({
      freq: RecurrenceFreq.Weekly,
      interval: 1,
      byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'],
    });
    expect(result.title).toBe('inbox opruimen');
  });

  it('herkent een weekdag-herhaling', () => {
    expect(parseQuickCapture('Elke maandag weekplanning', ctx).recurrence).toMatchObject({
      freq: RecurrenceFreq.Weekly,
      byWeekday: ['MO'],
    });
  });

  it('herkent een interval', () => {
    expect(parseQuickCapture('Om de 3 dagen planten water geven', ctx).recurrence).toMatchObject({
      freq: RecurrenceFreq.Daily,
      interval: 3,
    });
  });

  it('herkent bijwoorden', () => {
    expect(parseQuickCapture('Backup maken wekelijks', ctx).recurrence).toMatchObject({
      freq: RecurrenceFreq.Weekly,
      interval: 1,
    });
  });

  it('geeft een herhalende taak meteen een startdatum', () => {
    expect(parseQuickCapture('Elke dag mediteren', ctx).dueDate).toBe('2026-08-25');
  });
});

describe('itemtype', () => {
  it('herkent een idee', () => {
    const result = parseQuickCapture('Idee: abonnementsmodel voor de webshop', ctx);
    expect(result.type).toBe(ItemType.Idea);
    expect(result.title).toBe('abonnementsmodel voor de webshop');
  });

  it('herkent een notitie', () => {
    expect(parseQuickCapture('Notitie: besproken met Microsoft', ctx).type).toBe(ItemType.Note);
  });

  it('gaat standaard uit van een taak', () => {
    expect(parseQuickCapture('Iets doen', ctx).type).toBe(ItemType.Task);
  });
});

describe('robuustheid', () => {
  it('laat tekst zonder herkenbare onderdelen intact', () => {
    const result = parseQuickCapture('Nadenken over de nieuwe positionering', ctx);
    expect(result.title).toBe('Nadenken over de nieuwe positionering');
    expect(result.dueDate).toBeNull();
    expect(result.tokens).toHaveLength(0);
  });

  it('valt terug op de ruwe invoer als er niets overblijft', () => {
    expect(parseQuickCapture('morgen', ctx).title).toBe('morgen');
  });

  it('verwerkt een lange zin met alles erin', () => {
    const result = parseQuickCapture(
      'Elke maandag om 09:00 weekrapport maken #werk @rapportage p2 30 min',
      ctx,
    );
    expect(result.title).toBe('weekrapport maken');
    expect(result.dueTime).toBe('09:00');
    expect(result.priority).toBe(Priority.High);
    expect(result.projectName).toBe('werk');
    expect(result.tagNames).toEqual(['rapportage']);
    expect(result.estimateMinutes).toBe(30);
    expect(result.recurrence?.byWeekday).toEqual(['MO']);
  });

  it('geeft posities terug zodat de UI kan highlighten', () => {
    const result = parseQuickCapture('Bel morgen om 14:00', ctx);
    const dateToken = result.tokens.find((token) => token.kind === 'DATE');
    expect(dateToken).toBeDefined();
    expect(result.raw.slice(dateToken?.start, dateToken?.end)).toBe('morgen');
  });

  it('kan met een lege invoer om', () => {
    const result = parseQuickCapture('   ', ctx);
    expect(result.title).toBe('');
    expect(result.tokens).toHaveLength(0);
  });
});
