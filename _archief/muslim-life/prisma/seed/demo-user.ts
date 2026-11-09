import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Development accounts with a fully populated day, so My Day can be evaluated
 * without ten minutes of clicking.
 *
 * Idempotent: every write is an upsert or a delete-then-insert keyed on stable
 * identifiers, so re-running the seed converges rather than accumulating.
 *
 * Never runs when NODE_ENV=production — see prisma/seed/index.ts.
 */

const DEMO_PASSWORD = 'MuslimLife2026!'

interface HabitSeed {
  key: string
  name: string
  icon: string
  color: string
  category: 'WORSHIP' | 'HEALTH' | 'LEARNING' | 'FAMILY' | 'PERSONAL'
  type: 'BOOLEAN' | 'COUNTER' | 'DURATION'
  targetValue: number
  unit: string | null
  frequencyType: 'DAILY' | 'SPECIFIC_DAYS' | 'TIMES_PER_WEEK'
  targetPerPeriod: number
  daysOfWeek: number[]
  preferredTimeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'
}

const HABITS: HabitSeed[] = [
  {
    key: 'quran',
    name: 'Read Qur’an',
    icon: 'book-open',
    color: 'emerald',
    category: 'WORSHIP',
    type: 'COUNTER',
    targetValue: 5,
    unit: 'pages',
    frequencyType: 'DAILY',
    targetPerPeriod: 7,
    daysOfWeek: [],
    preferredTimeOfDay: 'MORNING',
  },
  {
    key: 'morning-adhkar',
    name: 'Morning adhkar',
    icon: 'sunrise',
    color: 'gold',
    category: 'WORSHIP',
    type: 'BOOLEAN',
    targetValue: 1,
    unit: null,
    frequencyType: 'DAILY',
    targetPerPeriod: 7,
    daysOfWeek: [],
    preferredTimeOfDay: 'MORNING',
  },
  {
    key: 'read',
    name: 'Read 20 min',
    icon: 'book',
    color: 'emerald',
    category: 'LEARNING',
    type: 'DURATION',
    targetValue: 20,
    unit: 'minutes',
    frequencyType: 'DAILY',
    targetPerPeriod: 7,
    daysOfWeek: [],
    preferredTimeOfDay: 'EVENING',
  },
  {
    key: 'walk',
    name: 'Walk',
    icon: 'footprints',
    color: 'emerald',
    category: 'HEALTH',
    type: 'BOOLEAN',
    targetValue: 1,
    unit: null,
    frequencyType: 'SPECIFIC_DAYS',
    targetPerPeriod: 3,
    daysOfWeek: [1, 3, 5],
    preferredTimeOfDay: 'AFTERNOON',
  },
  {
    key: 'journal',
    name: 'Journal',
    icon: 'pen-line',
    color: 'emerald',
    category: 'PERSONAL',
    type: 'BOOLEAN',
    targetValue: 1,
    unit: null,
    frequencyType: 'TIMES_PER_WEEK',
    targetPerPeriod: 4,
    daysOfWeek: [],
    preferredTimeOfDay: 'EVENING',
  },
]

interface TaskSeed {
  title: string
  scheduledTime: string | null
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  status: 'TODO' | 'COMPLETED'
  isPriority: boolean
  offsetDays: number
  estimatedMinutes: number | null
  category: 'WORK' | 'PERSONAL' | 'HEALTH' | 'FAMILY' | 'ERRAND' | null
}

const TASKS: TaskSeed[] = [
  // Today
  { title: 'Finish client proposal', scheduledTime: '09:00', priority: 'HIGH', status: 'TODO', isPriority: true, offsetDays: 0, estimatedMinutes: 120, category: 'WORK' },
  { title: 'Call accountant', scheduledTime: '11:00', priority: 'HIGH', status: 'TODO', isPriority: true, offsetDays: 0, estimatedMinutes: 20, category: 'WORK' },
  { title: 'Gym', scheduledTime: '16:00', priority: 'NORMAL', status: 'TODO', isPriority: true, offsetDays: 0, estimatedMinutes: 60, category: 'HEALTH' },
  { title: 'Grocery shopping', scheduledTime: null, priority: 'LOW', status: 'TODO', isPriority: false, offsetDays: 0, estimatedMinutes: 45, category: 'ERRAND' },
  { title: 'Reply to Yusuf', scheduledTime: null, priority: 'NORMAL', status: 'COMPLETED', isPriority: false, offsetDays: 0, estimatedMinutes: null, category: 'PERSONAL' },
  // Upcoming
  { title: 'Prepare Friday khutbah notes', scheduledTime: '20:00', priority: 'NORMAL', status: 'TODO', isPriority: false, offsetDays: 1, estimatedMinutes: 45, category: 'PERSONAL' },
  { title: 'Family dinner', scheduledTime: '18:30', priority: 'NORMAL', status: 'TODO', isPriority: false, offsetDays: 2, estimatedMinutes: 90, category: 'FAMILY' },
  { title: 'Renew car insurance', scheduledTime: null, priority: 'HIGH', status: 'TODO', isPriority: false, offsetDays: 4, estimatedMinutes: 30, category: 'ERRAND' },
]

/** Tasks with no date at all — the Inbox. */
const INBOX_TASKS = [
  'Look into Arabic classes',
  'Book dentist appointment',
  'Research Umrah packages for spring',
]

interface BlockSeed {
  title: string
  startTime: string
  endTime: string
  type: 'FOCUS' | 'TASK' | 'APPOINTMENT' | 'PERSONAL'
  offsetDays: number
}

const BLOCKS: BlockSeed[] = [
  { title: 'Deep work — client project', startTime: '08:30', endTime: '11:30', type: 'FOCUS', offsetDays: 0 },
  { title: 'Lunch', startTime: '12:45', endTime: '13:30', type: 'PERSONAL', offsetDays: 0 },
  // Deliberately spans Asr in a Brussels summer, so the conflict advisory is
  // visible in the seeded state.
  { title: 'Afternoon focus', startTime: '14:00', endTime: '17:00', type: 'FOCUS', offsetDays: 0 },
  { title: 'Team standup', startTime: '09:30', endTime: '10:00', type: 'APPOINTMENT', offsetDays: 1 },
]

export async function seedDemoUser(prisma: PrismaClient) {
  const brussels = await prisma.city.findFirst({
    where: { slug: 'brussels' },
    select: { id: true, countryId: true, latitude: true, longitude: true, timezone: true },
  })
  if (!brussels) return null

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const email = 'demo@muslimlife.app'
  const adminEmail = 'admin@muslimlife.app'

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Mohamed Bouzid',
      passwordHash,
      onboardedAt: new Date(),
      timezone: brussels.timezone,
      subscription: { create: { plan: 'PREMIUM', status: 'ACTIVE', interval: 'YEARLY' } },
      preference: {
        create: {
          countryId: brussels.countryId,
          cityId: brussels.id,
          latitude: brussels.latitude,
          longitude: brussels.longitude,
          calculationMethod: 'MUSLIM_WORLD_LEAGUE',
          madhab: 'SHAFI',
          interests: ['FAMILY', 'FITNESS', 'LEARNING', 'FOOD'],
          goals: ['PRAY_CONSISTENTLY', 'READ_QURAN', 'BUILD_HABITS'],
          dailyQuranPages: 5,
        },
      },
    },
    update: { passwordHash, onboardedAt: new Date(), timezone: brussels.timezone },
    select: { id: true },
  })

  // Today in the user's timezone, never the seeder's.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: brussels.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const day = (offset: number) => {
    const date = new Date(`${today}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date
  }

  // ── Habits ────────────────────────────────────────────────────────────────
  for (const [index, seed] of HABITS.entries()) {
    const existing = await prisma.habit.findFirst({
      where: { userId: user.id, isPreset: seed.key },
      select: { id: true },
    })

    const habitData = {
      name: seed.name,
      icon: seed.icon,
      color: seed.color,
      category: seed.category,
      type: seed.type,
      targetValue: seed.targetValue,
      unit: seed.unit,
      frequencyType: seed.frequencyType,
      targetPerPeriod: seed.targetPerPeriod,
      daysOfWeek: seed.daysOfWeek,
      preferredTimeOfDay: seed.preferredTimeOfDay,
      active: true,
      deletedAt: null,
      sortOrder: index,
    }

    const habit = existing
      ? await prisma.habit.update({
          where: { id: existing.id },
          data: habitData,
          select: { id: true },
        })
      : await prisma.habit.create({
          data: { userId: user.id, isPreset: seed.key, ...habitData },
          select: { id: true },
        })

    // Thirty days of realistic history: mostly consistent, with genuine gaps.
    // A flawless record would misrepresent what this product is for.
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const date = day(-daysAgo)

      // Deterministic gaps, so reseeding reproduces the same history.
      if ((daysAgo * 7 + index * 3) % 9 === 0) continue

      // Weekday-scheduled habits only log on their days.
      if (seed.frequencyType === 'SPECIFIC_DAYS' && !seed.daysOfWeek.includes(date.getUTCDay())) {
        continue
      }
      // Times-per-week habits log on a subset.
      if (seed.frequencyType === 'TIMES_PER_WEEK' && daysAgo % 2 === 1) continue

      // Leave part of today open so there is something to tick.
      if (daysAgo === 0 && index >= 2) continue

      await prisma.habitLog.upsert({
        where: { habitId_localDate: { habitId: habit.id, localDate: date } },
        create: {
          habitId: habit.id,
          userId: user.id,
          localDate: date,
          status: 'COMPLETED',
          quantity: seed.type === 'BOOLEAN' ? null : seed.targetValue,
        },
        update: {
          status: 'COMPLETED',
          quantity: seed.type === 'BOOLEAN' ? null : seed.targetValue,
        },
      })
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  // Replace rather than accumulate, so reseeding is idempotent.
  await prisma.task.deleteMany({ where: { userId: user.id } })

  let priorityOrder = 0
  for (const [index, seed] of TASKS.entries()) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: seed.title,
        scheduledDate: day(seed.offsetDays),
        scheduledTime: seed.scheduledTime,
        priority: seed.priority,
        status: seed.status,
        completedAt: seed.status === 'COMPLETED' ? new Date() : null,
        isDailyPriority: seed.isPriority,
        priorityOrder: seed.isPriority ? priorityOrder++ : null,
        estimatedMinutes: seed.estimatedMinutes,
        category: seed.category,
        sortOrder: index,
      },
    })
  }

  for (const [index, title] of INBOX_TASKS.entries()) {
    await prisma.task.create({
      data: { userId: user.id, title, scheduledDate: null, sortOrder: index },
    })
  }

  // ── Planner blocks ────────────────────────────────────────────────────────
  await prisma.plannerBlock.deleteMany({ where: { userId: user.id } })
  for (const block of BLOCKS) {
    await prisma.plannerBlock.create({
      data: {
        userId: user.id,
        title: block.title,
        localDate: day(block.offsetDays),
        startTime: block.startTime,
        endTime: block.endTime,
        type: block.type,
      },
    })
  }

  // ── Prayers: four of five logged today, a realistic week behind it ─────────
  const PRAYERS = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = day(-daysAgo)
    // Today: Isha has not happened yet.
    const upTo = daysAgo === 0 ? 4 : 5

    for (let i = 0; i < upTo; i++) {
      const prayer = PRAYERS[i]!
      await prisma.prayerLog.upsert({
        where: { userId_date_prayer: { userId: user.id, date, prayer } },
        create: {
          userId: user.id,
          date,
          prayer,
          status: i === 1 && daysAgo % 3 === 0 ? 'JAMAAH' : 'ON_TIME',
        },
        update: {},
      })
    }
  }

  // ── Reflections for a few recent evenings ─────────────────────────────────
  const REFLECTIONS = [
    {
      offset: -1,
      gratitude: 'A quiet Fajr and coffee before the house woke up.',
      wentWell: 'Finished the proposal draft ahead of the deadline.',
      improveTomorrow: 'Put the phone away an hour before Isha.',
    },
    {
      offset: -3,
      gratitude: 'Family came over unannounced. Good evening.',
      wentWell: 'Prayed all five in the masjid.',
      improveTomorrow: 'Start the day with Qur’an instead of email.',
    },
  ]

  for (const reflection of REFLECTIONS) {
    const date = day(reflection.offset)
    await prisma.dailyReflection.upsert({
      where: { userId_localDate: { userId: user.id, localDate: date } },
      create: {
        userId: user.id,
        localDate: date,
        gratitude: reflection.gratitude,
        wentWell: reflection.wentWell,
        improveTomorrow: reflection.improveTomorrow,
      },
      update: {
        gratitude: reflection.gratitude,
        wentWell: reflection.wentWell,
        improveTomorrow: reflection.improveTomorrow,
      },
    })
  }

  // ── Daily summaries — per domain, no combined score ───────────────────────
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = day(-daysAgo)
    const data = {
      prayersLogged: daysAgo === 0 ? 4 : 5,
      prayersExcused: 0,
      habitsCompleted: daysAgo === 0 ? 2 : 4,
      habitsDue: 4,
      tasksCompleted: daysAgo === 0 ? 1 : 3,
      tasksPlanned: daysAgo === 0 ? 5 : 4,
      hasReflection: REFLECTIONS.some((r) => r.offset === -daysAgo),
    }

    await prisma.dailySummary.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, ...data },
      update: data,
    })
  }

  // ── Admin account ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Muslim Life Admin',
      passwordHash,
      role: 'ADMIN',
      onboardedAt: new Date(),
      timezone: brussels.timezone,
      subscription: { create: { plan: 'PREMIUM', status: 'ACTIVE', interval: 'YEARLY' } },
      preference: {
        create: {
          countryId: brussels.countryId,
          cityId: brussels.id,
          latitude: brussels.latitude,
          longitude: brussels.longitude,
        },
      },
    },
    update: { passwordHash, role: 'ADMIN', onboardedAt: new Date() },
  })

  return {
    email,
    adminEmail,
    password: DEMO_PASSWORD,
    habits: HABITS.length,
    tasks: TASKS.length + INBOX_TASKS.length,
    blocks: BLOCKS.length,
  }
}
