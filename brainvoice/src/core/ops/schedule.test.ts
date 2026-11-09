import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { parseAutomationText } from './schedule/automationParser';
import { computeNextRun, describeSpec, parseCron } from './schedule/nextRun';
import { routeTicket } from './roles';
import { backoffMs } from './queue/JobQueue';

const TZ = 'Europe/Brussels';
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });

describe('Scheduler – next run (timezone aware)', () => {
  it('keeps a daily 08:00 schedule at 08:00 local across the DST change', () => {
    // DST ends in Europe/Brussels on 2026-10-25 at 03:00.
    const next = computeNextRun({ kind: 'daily', at: '08:00' }, at('2026-10-24T09:00:00'), TZ);
    expect(next?.toISO()).toBe('2026-10-25T08:00:00.000+01:00');
    const after = computeNextRun({ kind: 'daily', at: '08:00' }, next!, TZ);
    expect(after?.toISO()).toBe('2026-10-26T08:00:00.000+01:00');
  });

  it('runs today when the time is still ahead and tomorrow otherwise', () => {
    expect(computeNextRun({ kind: 'daily', at: '18:00' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-10-03T18:00:00.000+02:00');
    expect(computeNextRun({ kind: 'daily', at: '08:00' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-10-04T08:00:00.000+02:00');
  });

  it('computes weekly, interval, once and cron schedules', () => {
    expect(computeNextRun({ kind: 'weekly', weekdays: [1], at: '09:00' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-10-05T09:00:00.000+02:00');
    expect(computeNextRun({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5], at: '08:00' }, at('2026-10-02T09:00:00'), TZ)?.toISO()).toBe('2026-10-05T08:00:00.000+02:00');
    expect(computeNextRun({ kind: 'interval', everyMinutes: 15 }, at('2026-10-03T10:07:30'), TZ)?.toISO()).toBe('2026-10-03T10:22:00.000+02:00');
    expect(computeNextRun({ kind: 'once', runAt: '2026-10-03T09:00:00+02:00' }, at('2026-10-03T10:00:00'), TZ)).toBeNull();
    expect(computeNextRun({ kind: 'once', runAt: '2026-10-03T11:00:00+02:00' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-10-03T11:00:00.000+02:00');
    expect(computeNextRun({ kind: 'cron', cron: '0 9 * * 1' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-10-05T09:00:00.000+02:00');
    expect(computeNextRun({ kind: 'cron', cron: '30 8 1 * *' }, at('2026-10-03T10:00:00'), TZ)?.toISO()).toBe('2026-11-01T08:30:00.000+01:00');
    expect(computeNextRun({ kind: 'cron', cron: '*/15 * * * *' }, at('2026-10-03T10:07:00'), TZ)?.toISO()).toBe('2026-10-03T10:15:00.000+02:00');
  });

  it('rejects invalid cron expressions', () => {
    expect(parseCron('a b c')).toBeNull();
    expect(parseCron('61 9 * * *')).toBeNull();
    expect(parseCron('0 9 * * 1')).not.toBeNull();
    expect(computeNextRun({ kind: 'cron', cron: 'nope' }, at('2026-10-03T10:00:00'), TZ)).toBeNull();
  });

  it('describes schedules in the user language', () => {
    expect(describeSpec({ kind: 'weekly', weekdays: [1], at: '09:00' }, 'nl')).toBe('elke maandag om 09:00');
    expect(describeSpec({ kind: 'interval', everyMinutes: 15 }, 'en')).toBe('every 15 minutes');
    expect(describeSpec({ kind: 'daily', at: '08:00' }, 'fr')).toBe('chaque jour à 08:00');
  });
});

describe('Natural-language automations (§163)', () => {
  const now = at('2026-10-03T10:00:00');

  it('turns "elke maandag om 9u: geef me de open facturen" into a weekly automation', () => {
    const preview = parseAutomationText('Elke maandag om 9u: geef me de open facturen', 'nl', now, TZ);
    expect(preview?.spec).toEqual({ kind: 'weekly', weekdays: [1], at: '09:00' });
    expect(preview?.action).toBe('Geef me de open facturen');
    expect(preview?.nextRunAt).toBe('2026-10-05T09:00:00+02:00');
  });

  it('understands weekdays, intervals and French', () => {
    expect(parseAutomationText('Every weekday at 8, send me my priorities', 'en', now, TZ)).toMatchObject({ spec: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5], at: '08:00' }, action: 'Send me my priorities' });
    expect(parseAutomationText('every 30 minutes check the mailbox', 'en', now, TZ)).toMatchObject({ spec: { kind: 'interval', everyMinutes: 30 }, action: 'Check the mailbox' });
    expect(parseAutomationText('Chaque lundi à 9h, résume mes mails', 'fr', now, TZ)).toMatchObject({ spec: { kind: 'weekly', weekdays: [1], at: '09:00' }, action: 'Résume mes mails' });
    expect(parseAutomationText('Elke ochtend mijn prioriteiten', 'nl', now, TZ)).toMatchObject({ spec: { kind: 'daily', at: '08:00' }, action: 'Mijn prioriteiten' });
  });

  it('returns null without a recurrence or without an action', () => {
    expect(parseAutomationText('Geef me de open facturen', 'nl', now, TZ)).toBeNull();
    expect(parseAutomationText('Elke maandag', 'nl', now, TZ)).toBeNull();
  });
});

describe('Role routing (§152)', () => {
  it('routes by cues and explains the decision', () => {
    expect(routeTicket('Fix the failing unit test in the invoice engine and run the tests').role).toBe('SOFTWARE_ENGINEER');
    expect(routeTicket('Maak een factuur voor Acme voor 5 dagen').role).toBe('ADMIN_ASSISTANT');
    expect(routeTicket('Welke blockers staan er nog open op project Dashboard?').role).toBe('PROJECT_MANAGER');
    expect(routeTicket('Vergelijk de drie CRM-tools en maak een rapport met bronnen').role).toBe('RESEARCH_ANALYST');
    expect(routeTicket('Schrijf een LinkedIn post over onze lancering').role).toBe('CREATIVE_ASSISTANT');
    const chief = routeTicket('Hallo');
    expect(chief.role).toBe('CHIEF_OF_STAFF');
    expect(chief.reason).toContain('chief of staff');
    expect(routeTicket('Do something', { source: 'email', emailId: 'e1' }).role).toBe('ADMIN_ASSISTANT');
  });
});

describe('Retry backoff', () => {
  it('grows exponentially, is bounded and deterministic', () => {
    const first = backoffMs(1);
    const second = backoffMs(2);
    const tenth = backoffMs(10);
    expect(first).toBeGreaterThanOrEqual(30_000);
    expect(second).toBeGreaterThan(first);
    expect(tenth).toBeLessThanOrEqual(60 * 60_000 * 1.1);
    expect(backoffMs(3)).toBe(backoffMs(3));
  });
});
