import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createWorkspaceWithDefaults, listTags, type Scope } from '@orbit/db';
import { ItemType, MemberRole, Priority, TaskStatus, TaskView } from '@orbit/types';
import { ulid } from '@orbit/utils';
import {
  convertItem,
  createItem,
  getDashboard,
  getItem,
  listByView,
  quickCapture,
  setTaskCompleted,
  updateItem,
} from '../src/use-cases/items';
import { register } from '../src/use-cases/auth';

/**
 * Integratietest tegen een echte PostgreSQL.
 *
 * Dit test precies wat een unittest niet kan: dat het filter dat @orbit/core
 * oplevert dezelfde rijen selecteert als de SQL die eruit volgt, dat de
 * triggers server_seq bijwerken, en dat een conversie het item met id en al
 * intact laat.
 */

const prisma = createPrismaClient({ databaseUrl: process.env.DATABASE_URL as string });

// Dinsdag 25 augustus 2026, 10:00 in Brussel.
const NOW = new Date('2026-08-25T08:00:00.000Z');
const TODAY = '2026-08-25';

let scope: Scope;

beforeAll(async () => {
  const auth = await register(
    { prisma, secret: 'integratietest-geheim-van-minstens-32-tekens' },
    {
      email: `test-${ulid().toLowerCase()}@orbit.test`,
      password: 'een-lang-testwachtwoord',
      name: 'Test Gebruiker',
      timeZone: 'Europe/Brussels',
      locale: 'nl',
      platform: 'WEB',
    },
  );

  scope = {
    db: prisma,
    userId: auth.user.id,
    workspaceId: auth.workspace.id,
    role: MemberRole.Owner,
    now: NOW,
    timeZone: 'Europe/Brussels',
    weekStartsOn: 1,
    showCompleted: false,
  };
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('registratie', () => {
  it('geeft de nieuwe gebruiker meteen een workspace met mappen en tags', async () => {
    const tags = await listTags(scope);
    expect(tags.map((tag) => tag.name)).toContain('Werk');

    const folders = await prisma.noteFolder.count({ where: { workspaceId: scope.workspaceId } });
    expect(folders).toBe(5);
  });

  it('isoleert workspaces van elkaar', async () => {
    const other = await createWorkspaceWithDefaults(prisma, {
      ownerId: scope.userId,
      name: 'Andere workspace',
      personal: false,
    });

    await createItem({ ...scope, workspaceId: other.id }, {
      type: ItemType.Task,
      title: 'Taak in de andere workspace',
    });

    const mine = await listByView(scope, TaskView.All, { limit: 100 });
    expect(mine.items.some((entry) => entry.item.title.includes('andere workspace'))).toBe(false);
  });
});

describe('quick capture', () => {
  it('maakt uit een zin een taak met datum, tijd en tag', async () => {
    const result = await quickCapture(scope, {
      text: 'Bel morgen om 14:00 met de boekhouder @finance',
    });

    expect(result.item.title).toBe('Bel met de boekhouder');
    expect(result.item.type).toBe(ItemType.Task);

    const stored = await getItem(scope, result.item.id);
    expect(stored.item.type).toBe(ItemType.Task);
    if (stored.item.type !== ItemType.Task) return;
    expect(stored.item.task.dueDate).toBe('2026-08-26');
    expect(stored.item.task.dueTime).toBe('14:00');
    expect(stored.tagIds).toHaveLength(1);
  });

  it('maakt een ontbrekend project aan en zet het item erbuiten de inbox', async () => {
    const result = await quickCapture(scope, { text: 'Domeinnaam kopen #nieuwe-webshop' });
    expect(result.createdProjectId).not.toBeNull();
    expect(result.item.inInbox).toBe(false);
    expect(result.item.projectId).toBe(result.createdProjectId);
  });

  it('zet een losse invoer zonder project in de inbox', async () => {
    const result = await quickCapture(scope, { text: 'Nieuwsbrief bedenken' });
    expect(result.item.inInbox).toBe(true);

    const inbox = await listByView(scope, TaskView.Inbox, { limit: 50 });
    expect(inbox.items.some((entry) => entry.item.id === result.item.id)).toBe(true);
  });

  it('herkent het type uit een voorvoegsel', async () => {
    const result = await quickCapture(scope, { text: 'Idee: abonnementsmodel voor de webshop' });
    expect(result.item.type).toBe(ItemType.Idea);
    expect(result.item.title).toBe('abonnementsmodel voor de webshop');
  });
});

describe('weergaven', () => {
  it('selecteert dezelfde taken als het filter voorschrijft', async () => {
    await createItem(scope, {
      type: ItemType.Task,
      title: 'Taak van vandaag',
      task: { dueDate: TODAY },
    });
    await createItem(scope, {
      type: ItemType.Task,
      title: 'Taak van vorige week',
      task: { dueDate: '2026-08-18' },
    });
    await createItem(scope, { type: ItemType.Task, title: 'Taak zonder datum' });

    const today = await listByView(scope, TaskView.Today, { limit: 50 });
    const titles = today.items.map((entry) => entry.item.title);
    expect(titles).toContain('Taak van vandaag');
    expect(titles).not.toContain('Taak van vorige week');
    expect(titles).not.toContain('Taak zonder datum');

    const overdue = await listByView(scope, TaskView.Overdue, { limit: 50 });
    expect(overdue.items.map((entry) => entry.item.title)).toContain('Taak van vorige week');

    const noDate = await listByView(scope, TaskView.NoDate, { limit: 50 });
    expect(noDate.items.map((entry) => entry.item.title)).toContain('Taak zonder datum');
  });

  it('houdt notities buiten de datumweergaven', async () => {
    await createItem(scope, { type: ItemType.Note, title: 'Een notitie' });
    const today = await listByView(scope, TaskView.Today, { limit: 50 });
    expect(today.items.every((entry) => entry.item.type === ItemType.Task)).toBe(true);
  });

  it('sorteert taken zonder deadline achteraan', async () => {
    const all = await listByView(scope, TaskView.All, { limit: 100 });
    const dueDates = all.items.map((entry) =>
      entry.item.type === ItemType.Task ? entry.item.task.dueDate : null,
    );
    const firstNull = dueDates.indexOf(null);
    if (firstNull >= 0) {
      expect(dueDates.slice(firstNull).every((date) => date === null)).toBe(true);
    }
  });
});

describe('afvinken', () => {
  it('sluit een gewone taak af', async () => {
    const item = await createItem(scope, {
      type: ItemType.Task,
      title: 'Factuur versturen',
      task: { dueDate: TODAY },
    });

    const result = await setTaskCompleted(scope, item.id, true, NOW.toISOString());
    expect(result.rescheduled).toBe(false);
    if (result.item.type !== ItemType.Task) return;
    expect(result.item.task.status).toBe(TaskStatus.Done);
    expect(result.item.task.completedAt).not.toBeNull();
  });

  it('schuift een herhalende taak door naar het volgende voorkomen', async () => {
    const item = await createItem(scope, {
      type: ItemType.Task,
      title: 'Weekplanning maken',
      task: {
        dueDate: TODAY,
        recurrence: { freq: 'WEEKLY', interval: 1, anchor: 'SCHEDULE' },
      },
    });

    const result = await setTaskCompleted(scope, item.id, true, NOW.toISOString());
    expect(result.rescheduled).toBe(true);
    expect(result.nextDueDate).toBe('2026-09-01');

    // De taak blijft bestaan met hetzelfde id: links en bijlagen blijven kloppen.
    const stored = await getItem(scope, item.id);
    if (stored.item.type !== ItemType.Task) return;
    expect(stored.item.id).toBe(item.id);
    expect(stored.item.task.status).toBe(TaskStatus.Todo);
    expect(stored.item.task.dueDate).toBe('2026-09-01');
  });

  it('zet de checklist terug bij een nieuwe ronde', async () => {
    const item = await createItem(scope, {
      type: ItemType.Task,
      title: 'Wekelijkse controle',
      task: { dueDate: TODAY, recurrence: { freq: 'WEEKLY', interval: 1, anchor: 'SCHEDULE' } },
      checklist: [
        { text: 'Punt een', done: true },
        { text: 'Punt twee', done: true },
      ],
    });

    await setTaskCompleted(scope, item.id, true, NOW.toISOString());
    const stored = await getItem(scope, item.id);
    expect(stored.checklist.every((entry) => !entry.done)).toBe(true);
  });

  it('legt elk voorkomen vast in het activiteitenlog', async () => {
    const item = await createItem(scope, {
      type: ItemType.Task,
      title: 'Dagelijkse taak',
      task: { dueDate: TODAY, recurrence: { freq: 'DAILY', interval: 1, anchor: 'SCHEDULE' } },
    });
    await setTaskCompleted(scope, item.id, true, NOW.toISOString());

    const activities = await prisma.activity.findMany({
      where: { entityId: item.id, action: 'COMPLETED' },
    });
    expect(activities).toHaveLength(1);
    expect((activities[0]?.payload as { rescheduledTo?: string })?.rescheduledTo).toBe('2026-08-26');
  });
});

describe('conversie', () => {
  it('maakt van een idee een taak zonder het id te verliezen', async () => {
    const idea = await createItem(scope, {
      type: ItemType.Idea,
      title: 'Referralprogramma',
      idea: { description: 'Klanten die doorverwijzen krijgen korting.' },
    });

    const converted = await convertItem(scope, idea.id, {
      targetType: ItemType.Task,
      keepBacklink: true,
    });

    expect(converted.id).toBe(idea.id);
    expect(converted.type).toBe(ItemType.Task);
    if (converted.type !== ItemType.Task) return;
    expect(converted.task.description).toBe('Klanten die doorverwijzen krijgen korting.');

    // Het oude detailrecord is opgeruimd, het nieuwe bestaat.
    expect(await prisma.ideaDetail.count({ where: { itemId: idea.id } })).toBe(0);
    expect(await prisma.taskDetail.count({ where: { itemId: idea.id } })).toBe(1);
  });

  it('behoudt tags bij een conversie', async () => {
    const tags = await listTags(scope);
    const tagId = tags[0]?.id as string;

    const note = await createItem(scope, {
      type: ItemType.Note,
      title: 'Meeting notes',
      tagIds: [tagId],
    });

    await convertItem(scope, note.id, { targetType: ItemType.Task, keepBacklink: true });
    const after = await getItem(scope, note.id);
    expect(after.tagIds).toContain(tagId);
  });
});

describe('sync-infrastructuur', () => {
  it('verhoogt server_seq bij elke wijziging', async () => {
    const item = await createItem(scope, { type: ItemType.Task, title: 'Klok testen' });
    const before = BigInt(item.serverSeq);

    const updated = await updateItem(scope, item.id, { title: 'Klok getest' });
    expect(BigInt(updated.serverSeq)).toBeGreaterThan(before);
  });

  it('raakt het item aan als alleen het detail wijzigt', async () => {
    const item = await createItem(scope, {
      type: ItemType.Task,
      title: 'Alleen detail wijzigen',
      task: { dueDate: TODAY },
    });
    const before = BigInt(item.serverSeq);

    await updateItem(scope, item.id, { task: { priority: Priority.Urgent } });
    const after = await getItem(scope, item.id);
    expect(BigInt(after.item.serverSeq)).toBeGreaterThan(before);
  });

  it('verwijdert zacht en houdt de rij als tombstone', async () => {
    const item = await createItem(scope, { type: ItemType.Task, title: 'Weg ermee' });
    await prisma.item.update({ where: { id: item.id }, data: { deletedAt: new Date() } });

    const row = await prisma.item.findUnique({ where: { id: item.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    const list = await listByView(scope, TaskView.All, { limit: 200 });
    expect(list.items.some((entry) => entry.item.id === item.id)).toBe(false);
  });
});

describe('dashboard', () => {
  it('telt en groepeert in één aanroep', async () => {
    const data = await getDashboard(scope);
    expect(data.date).toBe(TODAY);
    expect(data.summary.todayCount).toBeGreaterThan(0);
    expect(data.summary.overdueCount).toBeGreaterThan(0);
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.today.every((entry) => entry.item.type === ItemType.Task)).toBe(true);
  });
});
