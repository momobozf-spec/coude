import { z } from 'zod'

/** Reminder and report input validation (§9, §41). */

export const recurrenceEnum = z.enum([
  'ONE_TIME',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'HIJRI_YEARLY',
])

export const reminderTypeEnum = z.enum([
  'ZAKAT_DUE',
  'ZAKAT_PREPARATION',
  'SADAQAH_GOAL',
  'DOCUMENT',
  'CUSTOM',
])

export const calendarMethodEnum = z.enum(['GREGORIAN', 'ISLAMIC_UMALQURA'])

/** "HH:mm", 24-hour. Rejected server-side too, so a crafted body cannot slip past. */
export const localTimeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Gebruik een tijd in de vorm 09:00.')

/**
 * An IANA zone name. Deliberately not a free string: a fixed offset such as
 * "UTC+2" cannot survive DST and would silently drift (§7).
 */
export const timezoneString = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Kies een geldige tijdzone, bijvoorbeeld Europe/Brussels.')

export const reminderCreateSchema = z
  .object({
    type: reminderTypeEnum,
    title: z.string().trim().min(1, 'Geef deze herinnering een titel.').max(160),
    description: z.string().trim().max(1000).nullable().optional(),

    startAt: z.coerce.date(),
    endAt: z.coerce.date().nullable().optional(),

    localTime: localTimeString.default('09:00'),
    timezone: timezoneString,

    recurrence: recurrenceEnum.default('ONE_TIME'),

    calendarMethod: calendarMethodEnum.default('GREGORIAN'),
    /** Whole days, small by design: beyond that it is a different date (§3). */
    manualAdjustmentDays: z.number().int().min(-3).max(3).default(0),

    zakatCalculationId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => !data.endAt || data.endAt.getTime() > data.startAt.getTime(),
    { message: 'De einddatum moet na de startdatum liggen.', path: ['endAt'] },
  )
  .refine(
    // A one-time reminder with an end date is a contradiction that would only
    // confuse the scheduler.
    (data) => data.recurrence !== 'ONE_TIME' || !data.endAt,
    { message: 'Een eenmalige herinnering heeft geen einddatum.', path: ['endAt'] },
  )

export type ReminderCreatePayload = z.infer<typeof reminderCreateSchema>

export const reminderUpdateSchema = reminderCreateSchema

export const reminderStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
})

// ── Reports ──────────────────────────────────────────────────────────────────

export const reportPeriodEnum = z.enum(['GREGORIAN_YEAR', 'HIJRI_YEAR'])

export const annualReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  /** MVP supports Gregorian years only; the enum keeps the namespace separate (§35). */
  periodType: reportPeriodEnum.default('GREGORIAN_YEAR'),
})

export type AnnualReportQuery = z.infer<typeof annualReportQuerySchema>
