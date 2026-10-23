import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import type { NotificationEvent, Reminder, ReminderType } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/services/audit'
import { InAppNotificationChannel } from '@/server/modules/notifications/in-app-channel'
import { emailConfigured, getEmailSender, type EmailSender } from '@/server/integrations/email'
import { appBaseUrl } from '@/config/env'
import type { NotificationChannelAdapter } from '@/server/modules/notifications/channels'
import {
  calculateNextOccurrence,
  occurrenceKey,
} from '@/server/modules/reminders/scheduling'

/**
 * The due-reminder processor (§21, §22, §23).
 *
 * This is the whole scheduling engine. The worker (`src/worker/index.ts`) calls
 * `processDueReminders(now)` every minute; no business logic lives in that
 * caller. Tests drive it directly with a frozen
 * clock, which is why none of this depends on the real time.
 *
 * ── At-least-once, exactly-one-notification ──────────────────────────────────
 * The scheduler is assumed to be able to offer the same due reminder twice: a
 * retry, an overlapping run, two instances. Safety therefore does not rest on
 * "only run once". Each occurrence has a deterministic key
 * (`reminder:<id>:<occurrenceISO>`), and the unique index on
 * `(userId, dedupeKey)` rejects the second insert. Two concurrent workers
 * produce exactly one notification and both report success.
 *
 * Advancing `nextTriggerAt` is likewise idempotent: it is recomputed from the
 * occurrence that was just handled, so replaying a run lands on the same value
 * rather than skipping ahead.
 */

export interface ProcessResult {
  /** Reminders that were due and examined. */
  examined: number
  /** Notifications actually created. */
  delivered: number
  /** Occurrences already handled by another run. */
  deduplicated: number
  /** Skipped because the user turned this category off. */
  suppressed: number
  /** Reminders whose series ended, moved to COMPLETED. */
  completed: number
  failed: number
}

export interface ProcessOptions {
  /** Cap per run, so one invocation cannot monopolise the database. */
  batchSize?: number
  channel?: NotificationChannelAdapter
  /**
   * Verzender voor de e-mailkopie. Standaard de geconfigureerde provider, of
   * geen e-mail als `EMAIL_PROVIDER=none`. `null` schakelt e-mail uit.
   */
  email?: EmailSender | null
}

/** Which notification event a reminder type produces (§37). */
const EVENT_FOR_TYPE: Record<ReminderType, NotificationEvent> = {
  ZAKAT_DUE: 'ZAKAT_REMINDER_DUE',
  ZAKAT_PREPARATION: 'ZAKAT_PREPARATION_DUE',
  SADAQAH_GOAL: 'SADAQAH_REMINDER_DUE',
  DOCUMENT: 'GENERAL',
  CUSTOM: 'GENERAL',
}

/**
 * Process every reminder due at or before `now`.
 *
 * `now` is a parameter, never `new Date()` inside the loop: a run must produce
 * the same result whether it takes ten milliseconds or ten seconds.
 */
export async function processDueReminders(
  now: Date = new Date(),
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const channel = options.channel ?? new InAppNotificationChannel()
  const batchSize = options.batchSize ?? 200
  const email = options.email === undefined ? (emailConfigured() ? getEmailSender() : null) : options.email

  const due = await prisma.reminder.findMany({
    where: {
      status: 'ACTIVE',
      nextTriggerAt: { not: null, lte: now },
    },
    orderBy: { nextTriggerAt: 'asc' },
    take: batchSize,
  })

  const result: ProcessResult = {
    examined: due.length,
    delivered: 0,
    deduplicated: 0,
    suppressed: 0,
    completed: 0,
    failed: 0,
  }

  for (const reminder of due) {
    try {
      const outcome = await processOne(reminder, now, channel, email)

      if (outcome === 'delivered') result.delivered += 1
      else if (outcome === 'deduplicated') result.deduplicated += 1
      else if (outcome === 'suppressed') result.suppressed += 1

      if (await advance(reminder, now)) result.completed += 1
    } catch (error) {
      result.failed += 1
      // One broken reminder must not stop the batch. Nothing user-identifying
      // beyond the id reaches the log (§38).
      logger.error('reminders.process_failed', {
        reminderId: reminder.id,
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  logger.info('reminders.processed', { ...result })

  return result
}

type Outcome = 'delivered' | 'deduplicated' | 'suppressed'

async function processOne(
  reminder: Reminder,
  now: Date,
  channel: NotificationChannelAdapter,
  email: EmailSender | null,
): Promise<Outcome> {
  // The occurrence being handled is the stored trigger, not `now` — that is what
  // makes the dedupe key stable across a retry that arrives a second later.
  const occurrence = reminder.nextTriggerAt ?? now

  if (!(await isEnabled(reminder))) return 'suppressed'

  const event = EVENT_FOR_TYPE[reminder.type]

  const delivery = await channel.send({
    userId: reminder.userId,
    event,
    title: reminder.title,
    body: reminder.description,
    href: hrefFor(reminder),
    dedupeKey: occurrenceKey(reminder.id, occurrence),
    reminderId: reminder.id,
    occurrenceAt: occurrence,
  })

  // De e-mail heeft een eigen dedupe-rij. Ook bij een gededupliceerde in-app-
  // melding nog proberen: liep een vorige ronde vast tussen in-app en e-mail,
  // dan komt de mail er zo alsnog — en nooit twee keer.
  if (email) await sendEmailCopy(email, reminder, occurrence, event)

  if (delivery.deduplicated) return 'deduplicated'

  await recordAudit({
    userId: reminder.userId,
    action: 'NOTIFICATION_CREATED',
    entityType: 'Notification',
    entityId: delivery.notificationId ?? null,
    metadata: { event, reminderId: reminder.id },
  })

  return 'delivered'
}

/**
 * E-mailkopie van een herinnering.
 *
 * Eén keer per occurrence: een eigen `Notification`-rij (kanaal EMAIL) met een
 * afgeleide dedupe-sleutel wordt vóór het versturen ingevoegd. Een tweede
 * worker botst op de unieke index en verstuurt niets. Mislukt het versturen,
 * dan blijft de rij op FAILED staan; de in-app-melding bestaat al, dus de
 * gebruiker mist niets.
 */
async function sendEmailCopy(
  sender: EmailSender,
  reminder: Reminder,
  occurrence: Date,
  event: NotificationEvent,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: reminder.userId },
    select: { email: true, deletedAt: true, notificationPreference: { select: { emailEnabled: true } } },
  })
  if (!user || user.deletedAt) return
  if (user.notificationPreference && !user.notificationPreference.emailEnabled) return

  const href = hrefFor(reminder)
  let rowId: string
  try {
    const row = await prisma.notification.create({
      data: {
        userId: reminder.userId,
        channel: 'EMAIL',
        event,
        title: reminder.title,
        body: reminder.description,
        href,
        reminderId: reminder.id,
        occurrenceAt: occurrence,
        dedupeKey: `${occurrenceKey(reminder.id, occurrence)}:email`,
        status: 'PENDING',
      },
      select: { id: true },
    })
    rowId = row.id
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return
    throw error
  }

  const base = appBaseUrl()
  const result = await sender.send({
    to: user.email,
    subject: reminder.title,
    text: [
      reminder.title,
      reminder.description ? `\n${reminder.description}` : '',
      `\nBekijk het in Barakah: ${base}${href}`,
      '\n—',
      `Je krijgt deze mail omdat je een herinnering instelde. E-mails uitzetten kan op ${base}/profile.`,
    ].join('\n'),
  })

  await prisma.notification.update({
    where: { id: rowId },
    data: result.delivered ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED' },
  })

  if (!result.delivered) {
    logger.error('reminders.email_failed', { reminderId: reminder.id, error: result.error })
  }
}

/**
 * Honour the user's category preferences (§17).
 *
 * A suppressed reminder still advances: turning notifications off should stop
 * the messages, not build a backlog that arrives all at once when they are
 * turned back on.
 */
async function isEnabled(reminder: Reminder): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: reminder.userId },
  })

  // No row means defaults, and the defaults are on.
  if (!preference) return true
  if (!preference.inAppEnabled) return false

  switch (reminder.type) {
    case 'ZAKAT_DUE':
    case 'ZAKAT_PREPARATION':
      return preference.zakatReminders
    case 'SADAQAH_GOAL':
      return preference.sadaqahReminders
    default:
      return preference.systemNotifications
  }
}

/** Deep link into the context the reminder is about. */
function hrefFor(reminder: Reminder): string {
  if (reminder.zakatCalculationId) {
    return `/zakat/calculations/${reminder.zakatCalculationId}`
  }
  if (reminder.type === 'SADAQAH_GOAL') return '/sadaqah'
  return '/zakat'
}

/**
 * Move the reminder to its next occurrence, or complete the series.
 *
 * Returns true when the reminder was completed. The update is conditional on
 * `nextTriggerAt` still holding the occurrence we handled, so a second worker
 * that already advanced it does not push the series forward twice.
 */
async function advance(reminder: Reminder, now: Date): Promise<boolean> {
  const handled = reminder.nextTriggerAt ?? now

  // Na een onderbreking (worker lag stil, server down) kan de afgehandelde
  // occurrence ver in het verleden liggen. De volgende wordt daarom gezocht ná
  // `now`, niet ná `handled`: anders levert elke run één gemiste dag op en krijgt
  // de gebruiker na vijf dagen stilstand vijf verouderde meldingen na elkaar.
  // Eén melding voor de gemiste periode, en daarna weer op schema.
  const next = calculateNextOccurrence({
    recurrence: reminder.recurrence,
    timezone: reminder.timezone,
    localTime: reminder.localTime,
    startAt: reminder.startAt,
    endAt: reminder.endAt,
    after: handled.getTime() > now.getTime() ? handled : now,
  })

  const updated = await prisma.reminder.updateMany({
    // Compare-and-set: only the worker still seeing the handled occurrence wins.
    where: { id: reminder.id, nextTriggerAt: handled },
    data: {
      lastTriggeredAt: handled,
      nextTriggerAt: next,
      // A one-time reminder, or a series past its end date, is finished. It is
      // not cancelled — the user never asked for that (§13).
      status: next ? 'ACTIVE' : 'COMPLETED',
    },
  })

  return updated.count > 0 && next === null
}

/**
 * Recompute `nextTriggerAt` for reminders that have drifted — for instance after
 * a deployment changed scheduling behaviour. Safe to run repeatedly.
 */
export async function resyncReminderSchedules(now: Date = new Date()): Promise<number> {
  const reminders = await prisma.reminder.findMany({
    where: { status: 'ACTIVE' },
    take: 1000,
  })

  let updated = 0

  for (const reminder of reminders) {
    const next = calculateNextOccurrence({
      recurrence: reminder.recurrence,
      timezone: reminder.timezone,
      localTime: reminder.localTime,
      startAt: reminder.startAt,
      endAt: reminder.endAt,
      after: reminder.lastTriggeredAt ?? new Date(now.getTime() - 1),
    })

    if (next?.getTime() !== reminder.nextTriggerAt?.getTime()) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { nextTriggerAt: next, status: next ? 'ACTIVE' : 'COMPLETED' },
      })
      updated += 1
    }
  }

  return updated
}
