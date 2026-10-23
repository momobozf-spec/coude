import type { PrismaClient } from '@/generated/prisma/client'

import { calculateNextOccurrence } from '../../src/server/modules/reminders/scheduling'
import { toHijri } from '../../src/server/modules/calendar/islamic-calendar'

/**
 * Reminder and notification demo data.
 *
 * Deliberately shaped so the notification centre has something to show on first
 * run without a scheduler having ever executed: one already-delivered
 * notification, one reminder still ahead, and one paused.
 *
 * Idempotent — rows for the seeded user are replaced.
 */
export async function seedReminders(
  prisma: PrismaClient,
  userId: string,
  calculationId: string | null,
  timezone = 'Europe/Brussels',
) {
  await prisma.notification.deleteMany({ where: { userId } })
  await prisma.reminder.deleteMany({ where: { userId } })

  const now = new Date()

  // Next lunar anniversary of a March reckoning date.
  const zakatAnchor = new Date('2026-03-15T08:00:00.000Z')
  const zakatNext = calculateNextOccurrence({
    recurrence: 'HIJRI_YEARLY',
    timezone,
    localTime: '09:00',
    startAt: zakatAnchor,
    endAt: null,
    after: now,
  })

  const hijri = toHijri(zakatNext ?? zakatAnchor)

  const zakatReminder = await prisma.reminder.create({
    data: {
      userId,
      type: 'ZAKAT_DUE',
      title: 'Zakat-datum',
      description: 'Tijd om je Zakat-berekening voor dit jaar na te lopen.',
      startAt: zakatAnchor,
      nextTriggerAt: zakatNext,
      localTime: '09:00',
      timezone,
      recurrence: 'HIJRI_YEARLY',
      calendarMethod: 'ISLAMIC_UMALQURA',
      hijriDay: hijri.day,
      hijriMonth: hijri.month,
      hijriYear: hijri.year,
      zakatCalculationId: calculationId,
      status: 'ACTIVE',
    },
  })

  const sadaqahStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 8))
  const sadaqahNext = calculateNextOccurrence({
    recurrence: 'MONTHLY',
    timezone,
    localTime: '19:00',
    startAt: sadaqahStart,
    endAt: null,
    after: now,
  })

  await prisma.reminder.create({
    data: {
      userId,
      type: 'SADAQAH_GOAL',
      title: 'Maandelijkse Sadaqah',
      description: 'Even kijken hoe je Sadaqah-doel ervoor staat.',
      startAt: sadaqahStart,
      nextTriggerAt: sadaqahNext,
      localTime: '19:00',
      timezone,
      recurrence: 'MONTHLY',
      status: 'ACTIVE',
    },
  })

  // A paused reminder, so the lifecycle controls have something to act on.
  await prisma.reminder.create({
    data: {
      userId,
      type: 'CUSTOM',
      title: 'Bewijsstukken verzamelen',
      startAt: new Date(Date.UTC(now.getUTCFullYear(), 11, 1, 8)),
      nextTriggerAt: null,
      localTime: '09:00',
      timezone,
      recurrence: 'YEARLY',
      status: 'PAUSED',
    },
  })

  // One delivered notification. The dedupe key uses the same shape the processor
  // produces, so a real run cannot duplicate it.
  const deliveredAt = new Date(now.getTime() - 2 * 86_400_000)

  await prisma.notification.create({
    data: {
      userId,
      channel: 'IN_APP',
      event: 'ZAKAT_REMINDER_DUE',
      title: 'Zakat-datum',
      body: 'Tijd om je Zakat-berekening voor dit jaar na te lopen.',
      href: calculationId ? `/zakat/calculations/${calculationId}` : '/zakat',
      status: 'SENT',
      sentAt: deliveredAt,
      reminderId: zakatReminder.id,
      occurrenceAt: deliveredAt,
      dedupeKey: `reminder:${zakatReminder.id}:${deliveredAt.toISOString()}`,
    },
  })

  return { reminders: 3, notifications: 1 }
}
