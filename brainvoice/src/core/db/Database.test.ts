import { describe, expect, it } from 'vitest';

import { openDatabase, eraseAllData } from './Database';
import { MIGRATIONS } from './migrations';
import { NodeSqliteDriver } from './testing/NodeSqliteDriver';
import { createFixedClock } from '../services/Clock';
import { NoteService } from '../services/NoteService';
import { SearchService } from '../services/SearchService';
import { TaskService } from '../services/TaskService';

const TZ = 'Europe/Brussels';

async function db() {
  return openDatabase(new NodeSqliteDriver(':memory:'));
}

describe('migrations', () => {
  it('applies every migration once and creates the FTS index', async () => {
    const driver = new NodeSqliteDriver(':memory:');
    const first = await openDatabase(driver);
    expect(first.migration.appliedVersions).toEqual(MIGRATIONS.map((m) => m.version));
    expect(first.migration.fts5).toBe(true);
    const second = await openDatabase(driver);
    expect(second.migration.appliedVersions).toEqual([]);
    const tables = await driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    const names = tables.map((t) => t.name);
    for (const expected of ['captures', 'notes', 'tasks', 'events', 'reminders', 'alarms', 'tags', 'item_tags', 'categories', 'item_links', 'action_history', 'conversation_context', 'settings', 'external_integrations', 'outbox', 'schema_migrations']) {
      expect(names).toContain(expected);
    }
    const categories = await first.categories.list();
    expect(categories.map((c) => c.name)).toContain('Business');
    expect(categories.find((c) => c.name === 'Work')?.isDefault).toBe(true);
  });
});

describe('repositories & services', () => {
  it('creates, searches and undoes notes through the search index', async () => {
    const database = await db();
    const clock = createFixedClock('2026-09-23T10:00:00', TZ);
    const notes = new NoteService(database, clock);
    const search = new SearchService(database, clock);
    const idea = await notes.create({ type: 'IDEA', content: 'An app for automatically analyzing products on Bol.com and finding opportunities', people: [], language: 'en' });
    expect(idea.category).toBe('Business');
    expect(idea.title).toContain('An app');
    await notes.create({ type: 'NOTE', content: 'Fabrice wants the top five risks weighted by severity', people: ['Fabrice'], language: 'en' });
    const hits = await search.search('bol.com');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe(idea.id);
    const byPerson = await search.search('risks', { person: 'Fabrice' });
    expect(byPerson).toHaveLength(1);
    const none = await search.search('risks', { person: 'Ruben' });
    expect(none).toHaveLength(0);
    await notes.delete(idea.id);
    expect(await search.search('bol.com')).toHaveLength(0);
  });

  it('filters search by date', async () => {
    const database = await db();
    const clock = createFixedClock('2026-09-22T10:00:00', TZ);
    const notes = new NoteService(database, clock);
    await notes.create({ type: 'NOTE', content: 'Databricks cluster sizing discussion', language: 'en' });
    clock.set('2026-09-23T10:00:00');
    await notes.create({ type: 'NOTE', content: 'Databricks follow-up with the team', language: 'en' });
    const search = new SearchService(database, clock);
    const yesterday = await search.search('databricks', { from: '2026-09-22', to: '2026-09-22' });
    expect(yesterday).toHaveLength(1);
    expect(yesterday[0]?.title).toContain('cluster');
  });

  it('manages tasks across views and resolves spoken targets', async () => {
    const database = await db();
    const clock = createFixedClock('2026-09-23T10:00:00', TZ);
    const tasks = new TaskService(database, clock);
    const milk = await tasks.create({ title: 'Buy milk', dueDate: '2026-09-23' });
    await tasks.create({ title: 'Call Youssef', dueDate: '2026-09-24', dueTime: '14:00' });
    await tasks.create({ title: 'Send invoice', dueDate: '2026-09-20' });
    await tasks.create({ title: 'Learn Arabic' });
    expect((await tasks.list('today')).map((t) => t.title)).toEqual(['Send invoice', 'Buy milk']);
    expect((await tasks.list('tomorrow')).map((t) => t.title)).toEqual(['Call Youssef']);
    expect((await tasks.list('overdue')).map((t) => t.title)).toEqual(['Send invoice']);
    expect((await tasks.list('inbox')).map((t) => t.title)).toEqual(['Learn Arabic']);
    const counts = await tasks.counts();
    expect(counts).toEqual({ today: 1, overdue: 1, inbox: 1, upcoming: 1 });
    const match = await tasks.findByQuery('buy milk');
    expect(match.best?.id).toBe(milk.id);
    expect(match.ambiguous).toBe(false);
    const call = await tasks.findByQuery('my call with youssef');
    expect(call.best?.title).toBe('Call Youssef');
    await tasks.complete(milk.id);
    expect((await tasks.list('completed')).map((t) => t.title)).toEqual(['Buy milk']);
    const tomorrowTask = (await tasks.list('tomorrow'))[0];
    expect(tomorrowTask?.dueAt).toBe('2026-09-24T14:00:00+02:00');
  });

  it('spawns the next occurrence when a recurring task is completed', async () => {
    const database = await db();
    const clock = createFixedClock('2026-09-23T10:00:00', TZ);
    const tasks = new TaskService(database, clock);
    const weekly = await tasks.create({ title: 'Submit timesheet', dueDate: '2026-09-28', recurrence: { frequency: 'WEEKLY', interval: 1, byWeekday: [1] } });
    await tasks.complete(weekly.id);
    const upcoming = await tasks.list('upcoming');
    expect(upcoming.map((t) => [t.title, t.dueDate])).toEqual([['Submit timesheet', '2026-10-05']]);
  });

  it('erases all data but keeps the schema', async () => {
    const database = await db();
    const clock = createFixedClock('2026-09-23T10:00:00', TZ);
    const notes = new NoteService(database, clock);
    await notes.create({ type: 'NOTE', content: 'secret', language: 'en' });
    await eraseAllData(database);
    expect(await notes.count()).toBe(0);
    expect((await database.categories.list()).length).toBeGreaterThan(0);
  });
});
