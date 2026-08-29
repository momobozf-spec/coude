import { z } from 'zod'

/**
 * Zod schemas for the iRail v1 API, written against real observed responses
 * (see tests/fixtures/irail/, captured 2026-08-29).
 *
 * Everything iRail returns is a STRING, including numbers and booleans.
 * These schemas are the single place where that is dealt with — no other module
 * should ever parse an iRail field by hand.
 */

/** `"0"` / `"1"` -> boolean. iRail never uses real booleans. */
const irailBool = z
  .union([z.literal('0'), z.literal('1'), z.boolean()])
  .transform((v) => v === '1' || v === true)

/** Unix timestamp in SECONDS, as a string. */
const irailTimestamp = z
  .string()
  .regex(/^-?\d+$/, 'expected a unix timestamp in seconds')
  .transform((v) => new Date(Number(v) * 1000))

/**
 * Delay in SECONDS, as a string, and it CAN BE NEGATIVE (train ahead of schedule).
 *
 * This is the single most dangerous field in the whole integration: reading
 * `"3600"` as minutes instead of seconds would turn a punctual train into a
 * 100%-compensation claim. It stays in seconds here; conversion to minutes is
 * the caller's explicit step via `secondsToDelayMinutes`.
 */
const irailDelaySeconds = z
  .string()
  .regex(/^-?\d+$/, 'expected delay in seconds')
  .transform((v) => Number(v))

export const stationInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  standardname: z.string().optional(),
  locationX: z.string().optional(),
  locationY: z.string().optional(),
})
export type StationInfo = z.infer<typeof stationInfoSchema>

export const stationsResponseSchema = z.object({
  station: z.array(stationInfoSchema),
})

export const vehicleInfoSchema = z.object({
  name: z.string(),
  shortname: z.string().optional(),
  /** Train number without the type prefix, e.g. "527". */
  number: z.string().optional(),
  /** IC, S, L, P, EXP ... */
  type: z.string().optional(),
})
export type VehicleInfo = z.infer<typeof vehicleInfoSchema>

// --------------------------------------------------------------------------
// connections — used to resolve which concrete train serves a route today
// --------------------------------------------------------------------------

const connectionEndpointSchema = z.object({
  delay: irailDelaySeconds,
  station: z.string(),
  stationinfo: stationInfoSchema,
  time: irailTimestamp,
  vehicle: z.string().optional(),
  vehicleinfo: vehicleInfoSchema.optional(),
  platform: z.string().optional(),
  canceled: irailBool.default(false),
  left: irailBool.optional(),
  arrived: irailBool.optional(),
})

const viaSchema = z.object({
  id: z.string(),
  station: z.string(),
  stationinfo: stationInfoSchema,
  /** Arrival of the leg BEFORE this via. */
  arrival: connectionEndpointSchema,
  /** Departure of the leg AFTER this via — this carries the next leg's train. */
  departure: connectionEndpointSchema,
  timebetween: z.string().optional(),
})

export const connectionSchema = z.object({
  id: z.string(),
  departure: connectionEndpointSchema,
  arrival: connectionEndpointSchema,
  /** Journey duration in seconds, as a string. */
  duration: z.string().optional(),
  vias: z
    .object({
      number: z.string(),
      via: z.array(viaSchema),
    })
    .optional(),
})
export type Connection = z.infer<typeof connectionSchema>

export const connectionsResponseSchema = z.object({
  connection: z.array(connectionSchema).default([]),
})

// --------------------------------------------------------------------------
// vehicle — the source of truth for arrival delay at the destination
// --------------------------------------------------------------------------

export const vehicleStopSchema = z.object({
  id: z.string(),
  station: z.string(),
  stationinfo: stationInfoSchema,
  time: irailTimestamp,
  scheduledArrivalTime: irailTimestamp.optional(),
  scheduledDepartureTime: irailTimestamp.optional(),
  /** Seconds. The number that decides a claim. */
  arrivalDelay: irailDelaySeconds.optional(),
  departureDelay: irailDelaySeconds.optional(),
  arrivalCanceled: irailBool.optional(),
  departureCanceled: irailBool.optional(),
  canceled: irailBool.optional(),
  delay: irailDelaySeconds.optional(),
  left: irailBool.optional(),
  arrived: irailBool.optional(),
  isExtraStop: irailBool.optional(),
  platform: z.string().optional(),
})
export type VehicleStop = z.infer<typeof vehicleStopSchema>

export const vehicleResponseSchema = z.object({
  vehicle: z.string().optional(),
  vehicleinfo: vehicleInfoSchema.optional(),
  stops: z.object({ stop: z.array(vehicleStopSchema).default([]) }),
})
export type VehicleResponse = z.infer<typeof vehicleResponseSchema>

// --------------------------------------------------------------------------
// Conversions
// --------------------------------------------------------------------------

/**
 * iRail seconds -> whole minutes of delay, for compensation purposes.
 *
 * - Negative delays (early arrival) clamp to 0: you cannot be compensated for
 *   arriving early.
 * - Truncates rather than rounds. A 59-minute-59-second delay is 59 minutes,
 *   not 60. We never round a journey UP across a compensation threshold —
 *   claiming on a threshold we did not actually reach is exactly the kind of
 *   overreach this product must not make.
 */
export function secondsToDelayMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.floor(seconds / 60)
}

/**
 * The train that actually arrives at the final destination.
 *
 * With transfers, the last leg's train is the DEPARTURE vehicle of the last via
 * — not the top-level departure vehicle, which is only the first leg.
 */
export function resolveFinalLegVehicle(connection: Connection): VehicleInfo | null {
  const vias = connection.vias?.via
  if (vias && vias.length > 0) {
    return vias[vias.length - 1].departure.vehicleinfo ?? null
  }
  return connection.departure.vehicleinfo ?? null
}

/** Find a stop by station id. Never match by index — extra stops shift them. */
export function findStopByStationId(
  stops: VehicleStop[],
  stationId: string,
): VehicleStop | null {
  return stops.find((s) => s.stationinfo.id === stationId) ?? null
}
