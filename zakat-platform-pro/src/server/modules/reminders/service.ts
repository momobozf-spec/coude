import 'server-only'

import type { Prisma, Reminder } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertOwner, ownedBy } from '@/server/auth/scope'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { NotFoundError } from '@/lib/errors'
import {
  InvalidCalendarDateInputError,
  InvalidRecurrenceInputError,
  InvalidTimezoneInputError,
  ReminderNotFoundError,
} from '@/server/modules/reminders/errors'
import {
  calculateNextOccurrence,
  InvalidRecurrenceError,
} from '@/server/modules/reminders/scheduling'
import { InvalidTimezoneError, toWallClock } from '@/server/modules/reminders/timezone'
import {
  InvalidCalendarDateError,
  applyManualAdjustment,
  toHijri,
} from '@/server/modules/calendar/islamic-calendar'
import type { ReminderCreatePayload } from '@/modules/reminders/schemas'

/**
 * Reminder CRUD and lifecycle (§10, §11, §19).
 *
 * Reminders are strictly personal. Unlike assets and donations they carry no
 * `householdId`: a shared household view of somebody's private prompts to
 * themselves is not a feature anyone asked for, and it would widen the blast
 * radius of the sharing model for no benefit (§19).
 */

export interface ReminderView {
  id: string
  type: Reminder['type']
  title: string
  description: string | null

  startAt: Date
  endAt: Date | null
  nextTriggerAt: Date | null
  lastTriggeredAt: Date | null

  localTime: string
  timezone: string
  recurrence: Reminder['recurrence']
  status: Reminder['status']

  calendarMethod: Reminder['calendarMethod']
  /** The estimated Hijri rendering of the next occurrence, for display only. */
  hijriLabel: string | null
  manualAdjustmentDays: number

  zakatCalculationId: string | null
  createdAt: Date
}

function toView(row: Reminder): ReminderView {
  const anchor = row.nextTriggerAt ?? row.startAt

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    startAt: row.startAt,
    endAt: row.endAt,
    nextTriggerAt: row.nextTriggerAt,
    lastTriggeredAt: row.lastTriggeredAt,
    localTime: row.localTime,
    timezone: row.timezone,
    recurrence: row.recurrence,
    status: row.status,
    calendarMethod: row.calendarMethod,
    hijriLabel: safeHijriLabel(anchor),
    manualAdjustmentDays: row.manualAdjustmentDays,
    zakatCalculationId: row.zakatCalculationId,
    createdAt: row.createdAt,
  }
}

/** Display-only: a calendar hiccup must never take down the reminder list. */
function safeHijriLabel(date: Date | null): string | null {
  if (!date) return null
  try {
    return toHijri(date).formatted
  } catch {
    return null
  }
}

// ── Reading ──────────────────────────────────────────────────────────────────

export async function listReminders(
  actor: Actor,
  options: { includeInactive?: boolean } = {},
): Promise<ReminderView[]> {
  const rows = await prisma.reminder.findMany({
    where: {
      ...ownedBy(actor),
      ...(options.includeInactive ? {} : { status: { in: ['ACTIVE', 'PAUSED'] } }),
    },
    orderBy: [{ nextTriggerAt: 'asc' }, { createdAt: 'desc' }],
  })

  return rows.map(toView)
}

export async function getReminder(actor: Actor, id: string): Promise<ReminderView> {
  // Scoped in the query itself: a reminder is personal, so there is no
  // household-visible variant to fall back to.
  const row = await prisma.reminder.findFirst({ where: { id, ...ownedBy(actor) } })
  if (!row) throw new ReminderNotFoundError()
  return toView(row)
}

// ── Writing ──────────────────────────────────────────────────────────────────

/**
 * Resolve the effective first occurrence.
 *
 * The manual adjustment is applied to the stored instants rather than kept as a
 * display offset, so the scheduler only ever sees absolute times (§6).
 */
function resolveStart(input: ReminderCreatePayload): Date {
  try {
    return applyManualAdjustment(input.startAt, input.manualAdjustmentDays)
  } catch (error) {
    if (error instanceof InvalidCalendarDateError) {
      throw new InvalidCalendarDateInputError(error.message)
    }
    throw error
  }
}

function computeNext(
  input: ReminderCreatePayload,
  startAt: Date,
  after: Date,
): Date | null {
  try {
    return calculateNextOccurrence({
      recurrence: input.recurrence,
      timezone: input.timezone,
      localTime: input.localTime,
      startAt,
      endAt: input.endAt ?? null,
      after,
    })
  } catch (error) {
    if (error instanceof InvalidTimezoneError) {
      throw new InvalidTimezoneInputError(error.message)
    }
    if (error instanceof InvalidRecurrenceError) {
      throw new InvalidRecurrenceInputError(error.message)
    }
    throw error
  }
}

async function assertCalculationBelongsToActor(
  actor: Actor,
  calculationId: string,
): Promise<void> {
  const calculation = await prisma.zakatCalculation.findUnique({
    where: { id: calculationId },
    select: { userId: true, householdId: true },
  })

  // 404 rather than 403, matching every other ownership check in the codebase.
  assertOwner(actor, calculation)
  if (!calculation) throw new NotFoundError()
}

export async function createReminder(
  actor: Actor,
  input: ReminderCreatePayload,
  now: Date = new Date(),
): Promise<ReminderView> {
  if (input.zakatCalculationId) {
    await assertCalculationBelongsToActor(actor, input.zakatCalculationId)
  }

  const startAt = resolveStart(input)

  // `now - 1ms` so a reminder created for an instant already reached still gets
  // that occurrence rather than skipping straight to the next one.
  const nextTriggerAt = computeNext(input, startAt, new Date(now.getTime() - 1))

  const hijri = safeHijri(startAt)

  const row = await prisma.reminder.create({
    data: {
      userId: actor.userId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      startAt,
      endAt: input.endAt ?? null,
      localTime: input.localTime,
      timezone: input.timezone,
      recurrence: input.recurrence,
      calendarMethod: input.calendarMethod,
      manualAdjustmentDays: input.manualAdjustmentDays,
      hijriDay: hijri?.day ?? null,
      hijriMonth: hijri?.month ?? null,
      hijriYear: hijri?.year ?? null,
      zakatCalculationId: input.zakatCalculationId ?? null,
      nextTriggerAt,
      status: 'ACTIVE',
    },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'REMINDER_CREATED',
    entityType: 'Reminder',
    entityId: row.id,
    // Categorical only — the title is the user's own words (§38).
    metadata: { type: row.type, recurrence: row.recurrence },
  })

  trackEvent('REMINDER_CREATED', actor.userId, { reminderType: row.type })

  return toView(row)
}

function safeHijri(date: Date) {
  try {
    return toHijri(date)
  } catch {
    return null
  }
}

export async function updateReminder(
  actor: Actor,
  id: string,
  input: ReminderCreatePayload,
  now: Date = new Date(),
): Promise<ReminderView> {
  const existing = await prisma.reminder.findUnique({ where: { id } })
  if (!existing || existing.userId !== actor.userId) throw new ReminderNotFoundError()

  if (input.zakatCalculationId) {
    await assertCalculationBelongsToActor(actor, input.zakatCalculationId)
  }

  const startAt = resolveStart(input)
  const nextTriggerAt = computeNext(input, startAt, new Date(now.getTime() - 1))
  const hijri = safeHijri(startAt)

  const row = await prisma.reminder.update({
    where: { id },
    data: {
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      startAt,
      endAt: input.endAt ?? null,
      localTime: input.localTime,
      timezone: input.timezone,
      recurrence: input.recurrence,
      calendarMethod: input.calendarMethod,
      manualAdjustmentDays: input.manualAdjustmentDays,
      hijriDay: hijri?.day ?? null,
      hijriMonth: hijri?.month ?? null,
      hijriYear: hijri?.year ?? null,
      zakatCalculationId: input.zakatCalculationId ?? null,
      nextTriggerAt,
    },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'REMINDER_UPDATED',
    entityType: 'Reminder',
    entityId: row.id,
    metadata: { type: row.type, recurrence: row.recurrence },
  })

  return toView(row)
}

/**
 * Change lifecycle state.
 *
 * Resuming recomputes `nextTriggerAt` from now, so a reminder paused for six
 * months does not wake up and fire every missed occurrence at once.
 */
export async function setReminderStatus(
  actor: Actor,
  id: string,
  status: Reminder['status'],
  now: Date = new Date(),
): Promise<ReminderView> {
  const existing = await prisma.reminder.findUnique({ where: { id } })
  if (!existing || existing.userId !== actor.userId) throw new ReminderNotFoundError()

  const data: Prisma.ReminderUpdateInput = { status }

  if (status === 'ACTIVE') {
    data.nextTriggerAt = calculateNextOccurrence({
      recurrence: existing.recurrence,
      timezone: existing.timezone,
      localTime: existing.localTime,
      startAt: existing.startAt,
      endAt: existing.endAt,
      after: now,
    })
  } else {
    // A paused or cancelled reminder must not be picked up by the processor.
    data.nextTriggerAt = null
  }

  const row = await prisma.reminder.update({ where: { id }, data })

  await recordAudit({
    userId: actor.userId,
    action:
      status === 'PAUSED'
        ? 'REMINDER_PAUSED'
        : status === 'CANCELLED'
          ? 'REMINDER_CANCELLED'
          : status === 'ACTIVE'
            ? 'REMINDER_RESUMED'
            : 'REMINDER_UPDATED',
    entityType: 'Reminder',
    entityId: row.id,
    metadata: { status },
  })

  if (status === 'COMPLETED') {
    trackEvent('REMINDER_COMPLETED', actor.userId, { reminderType: row.type })
  }

  return toView(row)
}

/**
 * Cancel a reminder.
 *
 * `DELETE` maps here rather than to a row deletion: a cancelled reminder is
 * still part of the account's history, and the notifications it produced point
 * at it.
 */
export async function cancelReminder(actor: Actor, id: string): Promise<ReminderView> {
  return setReminderStatus(actor, id, 'CANCELLED')
}

/**
 * Suggest a reminder for a finalised Zakat calculation (§52).
 *
 * Returns the proposal only — the user confirms, adjusts the date and saves. The
 * platform does not create reminders on somebody's behalf.
 */
export interface ReminderSuggestion {
  title: string
  startAt: Date
  hijriLabel: string | null
  recurrence: Reminder['recurrence']
  timezone: string
  localTime: string
}

export function suggestZakatReminder(
  actor: Actor,
  calculationDate: Date,
  now: Date = new Date(),
): ReminderSuggestion {
  // Next lunar anniversary of the reckoning date.
  const startAt = calculateNextOccurrence({
    recurrence: 'HIJRI_YEARLY',
    timezone: actor.timezone,
    localTime: '09:00',
    startAt: calculationDate,
    endAt: null,
    after: now,
  })

  const resolved = startAt ?? calculationDate

  return {
    title: 'Zakat-datum',
    startAt: resolved,
    hijriLabel: safeHijriLabel(resolved),
    recurrence: 'HIJRI_YEARLY',
    timezone: actor.timezone,
    localTime: '09:00',
  }
}

/** Wall-clock rendering of a reminder's next occurrence, for the UI. */
export function describeOccurrence(reminder: ReminderView): string | null {
  if (!reminder.nextTriggerAt) return null

  const wall = toWallClock(reminder.nextTriggerAt, reminder.timezone)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${pad(wall.day)}-${pad(wall.month)}-${wall.year} om ${pad(wall.hour)}:${pad(wall.minute)}`
}
