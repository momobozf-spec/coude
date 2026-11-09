import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { DeterministicParser } from './DeterministicParser';
import type { Command, CommandOf } from './schema';
import { SENTENCES } from '../__fixtures__/sentences';
import type { Language } from '../types/common';

const TZ = 'Europe/Brussels';
const NOW = DateTime.fromISO('2026-09-23T10:00:00', { zone: TZ });
const parser = new DeterministicParser();

function parse(text: string, language: Language): Command[] {
  const batch = parser.parse({ text, language, now: NOW, timezone: TZ, source: 'text' });
  return batch?.commands ?? [];
}

function whenOf(cmd: Command): { date: string | null; time: string | null; endTime: string | null } | null {
  if ('when' in cmd && cmd.when) return { date: cmd.when.date, time: cmd.when.time, endTime: cmd.when.endTime };
  if (cmd.intent === 'UPDATE_TASK' && cmd.changes.when) return { date: cmd.changes.when.date, time: cmd.changes.when.time, endTime: cmd.changes.when.endTime };
  if (cmd.intent === 'SEARCH_NOTES') return { date: cmd.filters.from, time: null, endTime: null };
  return null;
}

describe('DeterministicParser – fixture sentences', () => {
  for (const fixture of SENTENCES) {
    it(`[${fixture.language}] ${fixture.text}`, () => {
      const commands = parse(fixture.text, fixture.language);
      expect(commands.map((c) => c.intent)).toEqual(fixture.intents);
      const first = commands[0];
      expect(first).toBeDefined();
      if (!first || !fixture.expect) return;
      const e = fixture.expect;
      if (e.title !== undefined && 'title' in first) expect(first.title).toBe(e.title);
      const when = whenOf(first);
      if (e.date !== undefined) expect(when?.date).toBe(e.date);
      if (e.time !== undefined) expect(when?.time).toBe(e.time);
      if (e.endTime !== undefined) expect(when?.endTime).toBe(e.endTime);
      if (e.durationMinutes !== undefined && first.intent === 'CREATE_CALENDAR_EVENT') expect(first.durationMinutes).toBe(e.durationMinutes);
      if (e.durationSeconds !== undefined && first.intent === 'CREATE_TIMER') expect(first.durationSeconds).toBe(e.durationSeconds);
      if (e.query !== undefined && first.intent === 'SEARCH_NOTES') expect(first.query).toBe(e.query);
      if (e.targetQuery !== undefined && 'targetQuery' in first) expect(first.targetQuery).toBe(e.targetQuery);
      if (e.category !== undefined && 'category' in first) expect(first.category).toBe(e.category);
      if (e.alerts !== undefined && first.intent === 'CREATE_CALENDAR_EVENT') expect(first.alerts.map((a) => a.offsetMinutes)).toEqual(e.alerts);
      if (e.people !== undefined && 'people' in first) for (const p of e.people) expect(first.people).toContain(p);
      if (e.listName !== undefined && first.intent === 'CREATE_TASK') expect(first.listName).toBe(e.listName);
      if (e.date !== undefined && fixture.intents.length > 1) {
        // shared date prefix applies to every task in a list
        for (const cmd of commands) if (cmd.intent === 'CREATE_TASK') expect(cmd.when?.date).toBe(e.date);
      }
    });
  }
});

describe('DeterministicParser – details', () => {
  it('splits a task list into separate tasks with clean titles', () => {
    const cmds = parse('Tomorrow I need to buy milk, go to the pharmacy and call Youssef.', 'en') as CommandOf<'CREATE_TASK'>[];
    expect(cmds.map((c) => c.title)).toEqual(['Buy milk', 'Go to the pharmacy', 'Call Youssef']);
    expect(cmds[2]?.people).toContain('Youssef');
  });

  it('splits a Dutch task list', () => {
    const cmds = parse('Morgen moet ik melk kopen, naar de apotheek gaan en Youssef bellen.', 'nl') as CommandOf<'CREATE_TASK'>[];
    expect(cmds.map((c) => c.title)).toEqual(['Melk kopen', 'Naar de apotheek gaan', 'Youssef bellen']);
  });

  it('does not split "call Youssef and Fabrice" into two tasks', () => {
    const cmds = parse('I need to call Youssef and Fabrice', 'en');
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as CommandOf<'CREATE_TASK'>).title).toBe('Call Youssef and Fabrice');
  });

  it('parses three commands in one sentence with a shared date', () => {
    const cmds = parse('Tomorrow remind me at nine to call Yakup, add gym at seven to my calendar and note that I need to research electric cars.', 'en');
    expect(cmds.map((c) => c.intent)).toEqual(['CREATE_REMINDER', 'CREATE_CALENDAR_EVENT', 'CAPTURE_NOTE']);
    const [reminder, event, note] = cmds as [CommandOf<'CREATE_REMINDER'>, CommandOf<'CREATE_CALENDAR_EVENT'>, CommandOf<'CAPTURE_NOTE'>];
    expect(reminder.title).toBe('Call Yakup');
    expect(reminder.when?.date).toBe('2026-09-24');
    expect(reminder.when?.time).toBe('09:00');
    expect(event.title).toBe('Gym');
    expect(event.when?.date).toBe('2026-09-24');
    expect(event.when?.time).toBe('07:00');
    expect(note.content).toBe('I need to research electric cars');
  });

  it('attaches "remind me 30 minutes beforehand" as an alert on the preceding event', () => {
    const cmds = parse('Next Monday at 2 I have a meeting with Fabrice about the management dashboard. Remind me 30 minutes beforehand.', 'en');
    expect(cmds).toHaveLength(1);
    const event = cmds[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(event.title).toBe('Meeting with Fabrice');
    expect(event.notes).toBe('The management dashboard');
    expect(event.alerts).toEqual([{ offsetMinutes: -30 }]);
    expect(event.when?.iso).toBe('2026-09-28T14:00:00+02:00');
  });

  it('keeps ideas as ideas, not reminders or events', () => {
    const cmds = parse('I just had an idea. An app for automatically analyzing products on Bol.com and finding opportunities.', 'en');
    expect(cmds).toHaveLength(1);
    const idea = cmds[0] as CommandOf<'CAPTURE_IDEA'>;
    expect(idea.intent).toBe('CAPTURE_IDEA');
    expect(idea.content).toContain('Bol.com');
    expect(idea.category).toBe('Business');
    expect(idea.title.length).toBeLessThanOrEqual(61);
  });

  it('keeps knowledge statements as notes, never as calendar items', () => {
    const cmds = parse('I need to remember that Fabrice wants the top five risks weighted by severity.', 'en');
    expect(cmds[0]?.intent).toBe('CAPTURE_NOTE');
    const note = cmds[0] as CommandOf<'CAPTURE_NOTE'>;
    expect(note.content).toBe('Fabrice wants the top five risks weighted by severity');
    expect(note.people).toContain('Fabrice');
  });

  it('marks missing time for a meeting without a time', () => {
    const cmds = parse('Plan meeting with Youssef Friday.', 'en');
    const event = cmds[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(event.when?.date).toBe('2026-09-25');
    expect(event.when?.time).toBeNull();
  });

  it('extracts search filters and person', () => {
    const cmds = parse('What did I say about Databricks yesterday?', 'en');
    const search = cmds[0] as CommandOf<'SEARCH_NOTES'>;
    expect(search.query).toBe('Databricks');
    expect(search.filters.from).toBe('2026-09-22');
    const things = parse('What were the things Fabrice asked me to change?', 'en')[0] as CommandOf<'SEARCH_NOTES'>;
    expect(things.filters.person).toBe('Fabrice');
    const ideas = parse('Find my ideas about real estate.', 'en')[0] as CommandOf<'SEARCH_NOTES'>;
    expect(ideas.filters.types).toEqual(['IDEA']);
  });

  it('falls back to a thought/note for free text', () => {
    const cmds = parse('The new office coffee machine is surprisingly good.', 'en');
    expect(cmds[0]?.intent).toBe('CAPTURE_NOTE');
    expect(cmds[0]?.confidence).toBeLessThan(0.9);
    expect(cmds[0]?.warnings).toContain('fallback');
  });

  it('parses "Dentist Friday at 3" as an event with lower confidence', () => {
    const cmds = parse('Dentist Friday at 3', 'en');
    expect(cmds[0]?.intent).toBe('CREATE_CALENDAR_EVENT');
    expect((cmds[0] as CommandOf<'CREATE_CALENDAR_EVENT'>).when?.time).toBe('15:00');
    expect(cmds[0]?.confidence).toBeLessThan(0.9);
  });

  it('extracts a location for dinner plans', () => {
    const cmds = parse('Plan dinner with my wife Friday at seven at La Mamma', 'en');
    const event = cmds[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(event.title).toBe('Dinner with my wife');
    expect(event.location).toBe('La Mamma');
  });

  it('parses recurring reminders', () => {
    const cmds = parse('Every Monday at 9 remind me to submit my timesheet.', 'en');
    const reminder = cmds[0] as CommandOf<'CREATE_REMINDER'>;
    expect(reminder.when?.recurrence).toEqual({ frequency: 'WEEKLY', interval: 1, byWeekday: [1] });
  });

  it('detects priority words on tasks', () => {
    const cmds = parse('I need to send the invoice tomorrow, urgent', 'en');
    const task = cmds[0] as CommandOf<'CREATE_TASK'>;
    expect(task.priority).toBe('urgent');
    expect(task.title).toBe('Send the invoice');
  });

  it('returns null for empty input', () => {
    expect(parser.parse({ text: '   ', language: 'en', now: NOW, timezone: TZ, source: 'text' })).toBeNull();
  });
});
