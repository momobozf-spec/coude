import { z } from 'zod'

import { isValidIban, normaliseIban } from './crypto'

/**
 * Input validation. Every mutation validates here before touching the database.
 *
 * These schemas are deliberately strict about the two sensitive fields: a
 * mistyped IBAN means a compensation that never arrives, and a mistyped MoBIB
 * number means a dossier NMBS will reject outright.
 */

export const IRAIL_STATION_ID = /^BE\.NMBS\.\d+$/

export const languageSchema = z.enum(['nl', 'fr'])

export const ticketTypeSchema = z.enum([
  'SINGLE_TICKET',
  'RETURN_TICKET',
  'SUBSCRIPTION_1M',
  'SUBSCRIPTION_3M',
  'SUBSCRIPTION_12M',
])

/**
 * IBAN: normalised then checksum-verified (ISO 13616 mod-97).
 * Rejecting a typo here is far cheaper than discovering it after NMBS approves
 * a payout to a non-existent account.
 */
export const ibanSchema = z
  .string()
  .trim()
  .min(1, 'iban.required')
  .transform(normaliseIban)
  .refine(isValidIban, 'iban.invalid')

/**
 * MoBIB / subscription number. NMBS does not publish a checksum, so we validate
 * only the shape and deliberately do not invent a stricter rule than we can
 * justify — over-strict validation would lock out legitimate users.
 */
export const mobibSchema = z
  .string()
  .trim()
  .min(1, 'mobib.required')
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^\d{6,20}$/.test(v), 'mobib.invalid')

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'name.tooShort').max(200, 'name.tooLong'),
  language: languageSchema,
  // Optional: a user can create routes and receive notifications before
  // supplying payout details. We only need them when a dossier is generated.
  iban: ibanSchema.optional().nullable(),
  mobib_number: mobibSchema.optional().nullable(),
  ticket_type: ticketTypeSchema.optional().nullable(),
  /** Price of the travel document in euro, used for the indicative amount. */
  ticket_price_eur: z
    .number()
    .positive('price.invalid')
    .max(10_000, 'price.invalid')
    .optional()
    .nullable(),
})

export type ProfileInput = z.infer<typeof profileSchema>

/** ISO-8601 weekdays: 1 = Monday .. 7 = Sunday. */
export const weekdaySchema = z.number().int().min(1).max(7)

export const commuteRouteSchema = z
  .object({
    departure_station_id: z.string().regex(IRAIL_STATION_ID, 'station.invalid'),
    arrival_station_id: z.string().regex(IRAIL_STATION_ID, 'station.invalid'),
    departure_station_name: z.string().trim().min(1).max(120),
    arrival_station_name: z.string().trim().min(1).max(120),
    /** HH:MM, Belgian local time. */
    preferred_departure_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time.invalid'),
    days_of_week: z
      .array(weekdaySchema)
      .min(1, 'days.required')
      .max(7)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    active: z.boolean().default(true),
  })
  .refine(
    (route) => route.departure_station_id !== route.arrival_station_id,
    { message: 'station.sameStation', path: ['arrival_station_id'] },
  )

export type CommuteRouteInput = z.infer<typeof commuteRouteSchema>

/**
 * The mandate the user gives before we prepare a dossier on their behalf.
 * The version string is recorded so that, if the legal text changes, we know
 * exactly which wording each user agreed to.
 */
export const mandateSchema = z.object({
  accepted: z.literal(true, { message: 'mandate.required' }),
  text_version: z.string().min(1),
})

/** The claim confirmation. Explicit and unambiguous by design. */
export const claimConfirmationSchema = z.object({
  claim_id: z.string().uuid(),
  /** Must be literally true — no default, no coercion from a truthy value. */
  i_travelled_on_this_train: z.literal(true, { message: 'claim.mustConfirm' }),
})

export const manualTripSchema = z.object({
  departure_station_id: z.string().regex(IRAIL_STATION_ID, 'station.invalid'),
  arrival_station_id: z.string().regex(IRAIL_STATION_ID, 'station.invalid'),
  /** YYYY-MM-DD, Belgian calendar day. */
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date.invalid'),
  train_number: z.string().trim().min(1).max(10).optional(),
})

export type ManualTripInput = z.infer<typeof manualTripSchema>

/** Turn a ZodError into a field -> message map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    result[key] ??= issue.message
  }
  return result
}
