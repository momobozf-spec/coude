/**
 * Seed met realistische demodata.
 *
 * Bewust zonder imports uit de workspace-packages: Node weigert TypeScript te
 * strippen binnen node_modules, en workspace-packages zijn daar symlinks. Deze
 * losse ULID-implementatie is de prijs daarvoor.
 *
 * Draai met:  npm run db:seed --workspace @orbit/db
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(now = Date.now()) {
  let time = '';
  let value = now;
  for (let i = 9; i >= 0; i--) {
    const mod = value % 32;
    time = ENCODING[mod] + time;
    value = (value - mod) / 32;
  }
  const bytes = randomBytes(16);
  let random = '';
  for (let i = 0; i < 16; i++) random += ENCODING[bytes[i] % 32];
  return time + random;
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Eenvoudige oplopende sorteersleutels; genoeg voor seeddata. */
function sortKeys(count) {
  return Array.from({ length: count }, (_, index) => {
    const first = DIGITS[Math.min(30 + index, DIGITS.length - 1)];
    return index < 32 ? first : `${DIGITS[61]}${DIGITS[index - 32]}`;
  });
}

function daysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Date(date.toISOString().slice(0, 10));
}

function paragraph(text) {
  return { id: ulid(), type: 'PARAGRAPH', spans: [{ text }] };
}

function heading(text) {
  return { id: ulid(), type: 'HEADING_2', spans: [{ text }] };
}

function bullet(text) {
  return { id: ulid(), type: 'BULLET_ITEM', spans: [{ text }] };
}

async function main() {
  const email = 'demo@orbit.app';
  console.log(`Seeden voor ${email} ...`);

  await prisma.user.deleteMany({ where: { email } });

  const userId = ulid();
  const workspaceId = ulid();

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: 'Demo Gebruiker',
      passwordHash: await hash('demo-wachtwoord-2026', {
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }),
      timeZone: 'Europe/Brussels',
      locale: 'nl',
      emailVerifiedAt: new Date(),
      preferences: {
        theme: 'SYSTEM',
        weekStartsOn: 1,
        defaultReminderTime: '09:00',
        showCompleted: false,
        defaultReminderOffsetMinutes: 30,
      },
    },
  });

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: 'Demo Gebruiker',
      slug: `demo-${workspaceId.slice(-6).toLowerCase()}`,
      ownerId: userId,
      personal: true,
      memberships: { create: { userId, role: 'OWNER' } },
    },
  });

  // --- Mappen en tags -------------------------------------------------------
  const folderNames = ['Werk', 'Persoonlijk', 'Business', 'Ideeën', 'Projecten'];
  const folderKeys = sortKeys(folderNames.length);
  const folders = folderNames.map((name, index) => ({
    id: ulid(),
    workspaceId,
    name,
    sortKey: folderKeys[index],
  }));
  await prisma.noteFolder.createMany({ data: folders });

  const tagDefs = [
    ['Werk', '#4f46e5'],
    ['Privé', '#14b8a6'],
    ['Business', '#f97316'],
    ['Urgent', '#ef4444'],
    ['Finance', '#22c55e'],
    ['Klanten', '#8b5cf6'],
  ];
  const tags = tagDefs.map(([name, color]) => ({
    id: ulid(),
    workspaceId,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    color,
  }));
  await prisma.tag.createMany({ data: tags });
  const tagByName = Object.fromEntries(tags.map((tag) => [tag.name, tag.id]));

  // --- Projecten ------------------------------------------------------------
  const projectKeys = sortKeys(2);
  const webshop = {
    id: ulid(),
    workspaceId,
    name: 'Nieuwe webshop',
    description: 'Van domeinnaam tot eerste bestelling.',
    color: '#4f46e5',
    status: 'ACTIVE',
    priority: 'HIGH',
    startDate: daysFromNow(-14),
    endDate: daysFromNow(45),
    sortKey: projectKeys[0],
    favorite: true,
  };
  const werkproject = {
    id: ulid(),
    workspaceId,
    name: 'Werkproject Q3',
    description: 'Kwartaaldoelen en rapportage.',
    color: '#14b8a6',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    sortKey: projectKeys[1],
    favorite: false,
  };
  await prisma.project.createMany({ data: [webshop, werkproject] });

  // --- Items ----------------------------------------------------------------
  const itemKeys = sortKeys(20);
  let keyIndex = 0;
  const nextKey = () => itemKeys[keyIndex++ % itemKeys.length];

  async function createTask(input) {
    const id = ulid();
    await prisma.item.create({
      data: {
        id,
        workspaceId,
        type: 'TASK',
        title: input.title,
        preview: input.description ?? '',
        projectId: input.projectId ?? null,
        inInbox: input.inInbox ?? false,
        favorite: input.favorite ?? false,
        sortKey: nextKey(),
        capturedVia: input.capturedVia ?? 'MANUAL',
        createdById: userId,
        task: {
          create: {
            workspaceId,
            description: input.description ?? null,
            status: input.status ?? 'TODO',
            priority: input.priority ?? 'NONE',
            dueDate: input.dueDate ?? null,
            dueTime: input.dueTime ?? null,
            completedAt: input.status === 'DONE' ? new Date() : null,
            recurrence: input.recurrence ?? undefined,
          },
        },
      },
    });
    if (input.tags?.length) {
      await prisma.itemTag.createMany({
        data: input.tags.map((name) => ({ itemId: id, tagId: tagByName[name], workspaceId })),
      });
    }
    if (input.checklist?.length) {
      const keys = sortKeys(input.checklist.length);
      await prisma.checklistItem.createMany({
        data: input.checklist.map((text, index) => ({
          id: ulid(),
          workspaceId,
          itemId: id,
          text,
          sortKey: keys[index],
        })),
      });
    }
    return id;
  }

  await createTask({
    title: 'Klant bellen over offerte',
    description: 'Nabellen over de offerte van vorige week.',
    dueDate: daysFromNow(0),
    dueTime: '10:30',
    priority: 'HIGH',
    tags: ['Werk', 'Klanten'],
    projectId: werkproject.id,
  });
  await createTask({
    title: 'Factuur versturen',
    dueDate: daysFromNow(0),
    priority: 'HIGH',
    tags: ['Finance'],
  });
  await createTask({
    title: 'Rapport afwerken',
    dueDate: daysFromNow(0),
    priority: 'MEDIUM',
    projectId: werkproject.id,
    checklist: ['Cijfers verzamelen', 'Grafieken maken', 'Nalezen'],
  });
  await createTask({
    title: 'Btw-aangifte indienen',
    dueDate: daysFromNow(-3),
    priority: 'URGENT',
    tags: ['Finance', 'Urgent'],
  });
  await createTask({
    title: 'Domeinnaam kopen',
    dueDate: daysFromNow(2),
    projectId: webshop.id,
    tags: ['Business'],
  });
  await createTask({
    title: 'Design maken',
    dueDate: daysFromNow(9),
    projectId: webshop.id,
    priority: 'MEDIUM',
  });
  await createTask({
    title: 'Producten toevoegen',
    projectId: webshop.id,
    checklist: ['Fotos maken', 'Beschrijvingen schrijven', 'Prijzen bepalen'],
  });
  await createTask({
    title: 'Boekhouding bijwerken',
    dueDate: daysFromNow(1),
    recurrence: { freq: 'WEEKLY', interval: 1, byWeekday: ['MO'], anchor: 'SCHEDULE' },
    tags: ['Finance'],
  });
  await createTask({
    title: 'Inbox opruimen',
    dueDate: daysFromNow(0),
    recurrence: { freq: 'WEEKLY', interval: 1, byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'], anchor: 'SCHEDULE' },
  });
  await createTask({
    title: 'Teamoverleg voorbereiden',
    dueDate: daysFromNow(-1),
    status: 'DONE',
    projectId: werkproject.id,
  });
  await createTask({
    title: 'Nieuwsbrief bedenken',
    inInbox: true,
    capturedVia: 'QUICK',
  });

  // --- Notities -------------------------------------------------------------
  async function createNote(title, folderName, blocks, options = {}) {
    const plainText = blocks
      .map((block) => (block.spans ?? []).map((span) => span.text).join(''))
      .join('\n');
    const id = ulid();
    await prisma.item.create({
      data: {
        id,
        workspaceId,
        type: 'NOTE',
        title,
        preview: plainText.slice(0, 200),
        projectId: options.projectId ?? null,
        inInbox: false,
        favorite: options.favorite ?? false,
        sortKey: nextKey(),
        createdById: userId,
        note: {
          create: {
            workspaceId,
            content: blocks,
            plainText,
            folderId: folders.find((folder) => folder.name === folderName)?.id ?? null,
            pinned: options.pinned ?? false,
          },
        },
      },
    });
    return id;
  }

  await createNote(
    'Meeting Microsoft',
    'Werk',
    [
      heading('Besproken'),
      bullet('Licentiemodel voor volgend jaar'),
      bullet('Migratie naar Entra ID'),
      heading('Afspraken'),
      bullet('Offerte volgende week'),
      paragraph('Contactpersoon: Sarah, sarah@example.com'),
    ],
    { pinned: true },
  );
  await createNote('Technische architectuur', 'Projecten', [
    heading('Stack'),
    bullet('Next.js voor web'),
    bullet('Expo voor mobiel'),
    bullet('PostgreSQL met Prisma'),
    paragraph('Offline-first met een outbox en delta-sync.'),
  ], { projectId: webshop.id });
  await createNote('Marketingstrategie', 'Business', [
    paragraph('Focus op herhaalaankopen in plaats van eenmalige kortingen.'),
    bullet('E-mailflow na eerste bestelling'),
    bullet('Loyaliteitspunten'),
  ], { projectId: webshop.id });
  await createNote('Business ideeën', 'Ideeën', [
    paragraph('Losse invallen die nog uitgewerkt moeten worden.'),
  ]);

  // --- Ideeën ---------------------------------------------------------------
  async function createIdea(title, description, status, options = {}) {
    const id = ulid();
    await prisma.item.create({
      data: {
        id,
        workspaceId,
        type: 'IDEA',
        title,
        preview: description.slice(0, 200),
        projectId: options.projectId ?? null,
        inInbox: options.inInbox ?? false,
        favorite: options.favorite ?? false,
        sortKey: nextKey(),
        capturedVia: options.capturedVia ?? 'MANUAL',
        createdById: userId,
        idea: {
          create: {
            workspaceId,
            description,
            status,
            category: options.category ?? null,
            impact: options.impact ?? null,
            effort: options.effort ?? null,
          },
        },
      },
    });
    return id;
  }

  await createIdea(
    'SaaS-concept voor kleine boekhouders',
    'Een lichte tool die bankafschriften automatisch categoriseert.',
    'EXPLORING',
    { category: 'Business', impact: 5, effort: 4, favorite: true },
  );
  await createIdea('Referralprogramma', 'Klanten die doorverwijzen krijgen korting.', 'INTERESTING', {
    projectId: webshop.id,
    category: 'Groei',
    impact: 4,
    effort: 2,
  });
  await createIdea('Abonnement op verbruiksartikelen', 'Maandelijkse levering met korting.', 'NEW', {
    projectId: webshop.id,
    impact: 4,
    effort: 3,
  });
  await createIdea('Loyaltyprogramma', 'Punten sparen bij elke bestelling.', 'LATER', {
    projectId: webshop.id,
  });
  await createIdea('Podcast over ondernemen', 'Wekelijks een gesprek met een ondernemer.', 'NEW', {
    inInbox: true,
    capturedVia: 'QUICK',
  });

  const counts = {
    items: await prisma.item.count({ where: { workspaceId } }),
    projecten: await prisma.project.count({ where: { workspaceId } }),
    tags: await prisma.tag.count({ where: { workspaceId } }),
    mappen: await prisma.noteFolder.count({ where: { workspaceId } }),
  };

  console.log('Klaar.', counts);
  console.log(`Inloggen: ${email} / demo-wachtwoord-2026`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
