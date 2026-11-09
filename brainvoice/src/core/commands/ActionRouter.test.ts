import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRouter } from './ActionRouter';
import { createFakeAdapters } from './testing/fakeAdapters';
import { openDatabase, type Database } from '../db/Database';
import { NodeSqliteDriver } from '../db/testing/NodeSqliteDriver';
import { DEFAULT_ENGINE_CONFIG } from '../intent/config';
import { EMPTY_CONVERSATION_STATE } from '../intent/ContextResolver';
import { IntentEngine } from '../intent/IntentEngine';
import type { CommandBatch, CommandOf } from '../intent/schema';
import { createCoreServices, type CoreServices } from '../services';
import { createFixedClock } from '../services/Clock';

const TZ = 'Europe/Brussels';
const NOW = '2026-09-23T10:00:00';

let database: Database;
let services: CoreServices;
let adapters: ReturnType<typeof createFakeAdapters>;
let router: ActionRouter;
const engine = new IntentEngine({ config: DEFAULT_ENGINE_CONFIG });

async function parse(text: string, language: 'en' | 'nl' | 'fr' = 'en'): Promise<CommandBatch> {
  const { result } = await engine.process({ text, source: 'voice', language, deviceLanguage: 'en', timezone: TZ, now: DateTime.fromISO(NOW, { zone: TZ }), state: EMPTY_CONVERSATION_STATE });
  if (!result.batch) throw new Error(`no batch for ${text}`);
  return { ...result.batch, transcript: text };
}

beforeEach(async () => {
  database = await openDatabase(new NodeSqliteDriver(':memory:'));
  adapters = createFakeAdapters();
  const clock = createFixedClock(NOW, TZ);
  services = createCoreServices(database, clock, adapters.calendar);
  await services.settings.load();
  router = new ActionRouter({ services, adapters, clock, language: () => 'en' });
});

describe('ActionRouter – vertical slice', () => {
  it('creates a real reminder, records history and undoes it', async () => {
    const batch = await parse('Remind me tomorrow at 8 to call Yakup.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    expect(result?.summary).toContain('Call Yakup');
    expect(result?.undoable).toBe(true);
    expect(adapters.reminders.reminders.size).toBe(1);
    const [stored] = [...adapters.reminders.reminders.values()];
    expect(stored?.dueISO).toBe('2026-09-24T08:00:00+02:00');
    const reminders = await services.reminders.listOpen();
    expect(reminders[0]?.backend).toBe('eventkit');
    const captures = await services.captures.listRecent();
    expect(captures[0]?.transcript).toBe('Remind me tomorrow at 8 to call Yakup.');
    expect(captures[0]?.processed).toBe(true);

    const undo = await router.undo(result?.historyId ?? '');
    expect(undo.ok).toBe(true);
    expect(adapters.reminders.reminders.size).toBe(0);
    expect(await services.reminders.listOpen()).toHaveLength(0);
    const history = await services.history.listRecent();
    expect(history[0]?.undoStatus).toBe('undone');
  });

  it('falls back to a notification when Reminders access is denied', async () => {
    adapters.reminders.permission = 'denied';
    const batch = await parse('Remind me tomorrow at 8 to call Yakup.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    expect(result?.note).toContain('Reminders access was denied');
    expect(adapters.notifications.scheduled.size).toBe(1);
    const reminders = await services.reminders.listOpen();
    expect(reminders[0]?.backend).toBe('notification');
  });

  it('stores an idea in the Brain Inbox without touching the calendar', async () => {
    const batch = await parse('I have an idea for a halal product scanning app.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    expect(result?.createdItem?.type).toBe('IDEA');
    expect(adapters.calendar.events.size).toBe(0);
    const notes = await services.notes.list({ type: 'IDEA' });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toContain('halal');
    const hits = await services.search.search('halal');
    expect(hits).toHaveLength(1);
  });

  it('creates a device calendar event with the right times and undoes it', async () => {
    const batch = await parse('Put a meeting with Fabrice Friday at 2 in my calendar.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    const [event] = [...adapters.calendar.events.values()];
    expect(event?.title).toBe('Meeting with Fabrice');
    expect(event?.startISO).toBe('2026-09-25T14:00:00+02:00');
    expect(event?.endISO).toBe('2026-09-25T15:00:00+02:00');
    const mirror = await services.events.listBetween('2026-09-25T00:00:00+02:00', '2026-09-26T00:00:00+02:00');
    expect(mirror[0]?.externalId).toBe(event?.externalId);
    await router.undo(result?.historyId ?? '');
    expect(adapters.calendar.events.size).toBe(0);
  });

  it('refuses to create an event without calendar permission', async () => {
    adapters.calendar.permission = 'denied';
    const batch = await parse('Put a meeting with Fabrice Friday at 2 in my calendar.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(false);
    expect(result?.error?.code).toBe('CALENDAR_PERMISSION_DENIED');
    expect(result?.detail[0]).toContain('Calendar access was denied');
  });

  it('sets an AlarmKit alarm for tomorrow 06:30', async () => {
    const batch = await parse('Wake me tomorrow at 6:30.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    const [alarm] = [...adapters.alarms.alarms.values()];
    expect(alarm?.fireISO).toBe('2026-09-24T06:30:00+02:00');
    expect(alarm?.hour).toBe(6);
    expect(alarm?.minute).toBe(30);
    expect(adapters.notifications.scheduled.size).toBe(0);
    const undo = await router.undo(result?.historyId ?? '');
    expect(undo.ok).toBe(true);
    expect(adapters.alarms.alarms.size).toBe(0);
  });

  it('uses the clock app plus a safety notification on Android for the next occurrence, and only a notification for later dates', async () => {
    adapters.alarms.caps = { backend: 'android_clock', supportsExactDate: false, supportsCancel: true, supportsRecurrence: true, limitationNote: null };
    const tomorrow = await parse('Wake me tomorrow at 6:30.');
    const [r1] = await router.execute(tomorrow);
    expect(r1?.ok).toBe(true);
    expect(adapters.alarms.alarms.size).toBe(1);
    expect(adapters.notifications.scheduled.size).toBe(1);
    const nextWeek = await parse('Wake me next Wednesday at 6:30.');
    const [r2] = await router.execute(nextWeek);
    expect(r2?.ok).toBe(true);
    expect(adapters.alarms.alarms.size).toBe(1); // no second clock alarm
    expect(adapters.notifications.scheduled.size).toBe(2);
    expect(r2?.note).toContain('only supports a time');
  });

  it('starts a timer', async () => {
    const batch = await parse('Set a timer for 25 minutes.');
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(true);
    const [timer] = [...adapters.timers.timers.values()];
    expect(timer?.seconds).toBe(1500);
  });

  it('creates several tasks from one sentence and completes one by voice', async () => {
    const batch = await parse('Tomorrow I need to buy milk, go to the pharmacy and call Youssef.');
    const results = await router.execute(batch);
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await services.tasks.list('tomorrow')).map((t) => t.title)).toEqual(['Buy milk', 'Go to the pharmacy', 'Call Youssef']);
    const done = await parse('Mark buy milk as complete.');
    const [completed] = await router.execute(done);
    expect(completed?.ok).toBe(true);
    expect((await services.tasks.list('completed')).map((t) => t.title)).toEqual(['Buy milk']);
    await router.undo(completed?.historyId ?? '');
    expect((await services.tasks.list('completed'))).toHaveLength(0);
  });

  it('moves a task by voice and reports not-found for unknown targets', async () => {
    await router.execute(await parse('I need to call Youssef tomorrow.'));
    const move = await parse('Move my call with Youssef to Friday.');
    const [moved] = await router.execute(move);
    expect(moved?.ok).toBe(true);
    const tasks = await services.tasks.list('upcoming');
    expect(tasks[0]?.dueDate).toBe('2026-09-25');
    const missing = await parse('Mark paint the fence as done.');
    const [failed] = await router.execute(missing);
    expect(failed?.ok).toBe(false);
    expect(failed?.error?.code).toBe('NOT_FOUND');
  });

  it('answers agenda and task questions with payloads', async () => {
    await router.execute(await parse('Put a meeting with Fabrice tomorrow at 2 in my calendar.'));
    await router.execute(await parse('I need to send the invoice tomorrow.'));
    await router.execute(await parse('Remind me tomorrow at 18 to pick up the kids.'));
    const [agenda] = await router.execute(await parse('What does my day look like tomorrow?'));
    expect(agenda?.payload?.kind).toBe('agenda');
    if (agenda?.payload?.kind === 'agenda') {
      const day = agenda.payload.agenda.days[0];
      expect(day?.events.map((e) => e.title)).toEqual(['Meeting with Fabrice']);
      expect(day?.tasks.map((t) => t.title)).toEqual(['Send the invoice']);
      expect(day?.reminders.map((r) => r.title)).toEqual(['Pick up the kids']);
    }
    const [tasks] = await router.execute(await parse('What do I need to do tomorrow?'));
    expect(tasks?.payload?.kind).toBe('tasks');
    if (tasks?.payload?.kind === 'tasks') expect(tasks.payload.tasks.map((t) => t.title)).toEqual(['Send the invoice']);
  });

  it('searches earlier ideas by voice', async () => {
    await router.execute(await parse('I just had an idea. An app for automatically analyzing products on Bol.com and finding opportunities.'));
    const [search] = await router.execute(await parse('What did I say about my Bol.com idea?'));
    expect(search?.payload?.kind).toBe('search');
    if (search?.payload?.kind === 'search') {
      expect(search.payload.results).toHaveLength(1);
      expect(search.payload.results[0]?.type).toBe('IDEA');
    }
  });

  it('deletes and re-creates a calendar event on undo', async () => {
    await router.execute(await parse('Put a meeting with Fabrice Friday at 2 in my calendar.'));
    const [deleted] = await router.execute(await parse('Cancel my meeting with Fabrice.'));
    expect(deleted?.ok).toBe(true);
    expect(adapters.calendar.events.size).toBe(0);
    const undo = await router.undo(deleted?.historyId ?? '');
    expect(undo.ok).toBe(true);
    expect(adapters.calendar.events.size).toBe(1);
  });

  it('keeps the transcript out of the capture when the privacy setting says so', async () => {
    await services.settings.update({ privacy: { keepTranscripts: false } });
    await router.execute(await parse('I need to send the invoice tomorrow.'));
    const captures = await services.captures.listRecent();
    expect(captures[0]?.transcript).toBeNull();
    expect(captures[0]?.originalText).toBe('I need to send the invoice tomorrow.');
  });

  it('records a failed command in history without undo', async () => {
    const batch: CommandBatch = { id: 'b1', commands: [{ id: 'c1', intent: 'CREATE_TIMER', confidence: 0.9, language: 'en', originalText: 'x', requiresConfirmation: false, missingFields: [], clarificationQuestion: null, parser: 'manual', warnings: [], durationSeconds: null, label: null } satisfies CommandOf<'CREATE_TIMER'>], originalText: 'x', transcript: null, language: 'en', source: 'text', createdAt: NOW };
    const [result] = await router.execute(batch);
    expect(result?.ok).toBe(false);
    const history = await services.history.listRecent();
    expect(history[0]?.undoStatus).toBe('unavailable');
    expect(history[0]?.errorMessage).toContain('duration');
  });
});
