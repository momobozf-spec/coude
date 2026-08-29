import { TZDate } from '@date-fns/tz'
import { z } from 'zod'

import { getEnv } from '../env'
import { childLogger } from '../logger'
import {
  connectionsResponseSchema,
  stationsResponseSchema,
  vehicleResponseSchema,
  type Connection,
  type StationInfo,
  type VehicleResponse,
} from './schemas'

/**
 * iRail API client. Fair-use compliance is enforced here and nowhere else —
 * see docs/irail.md for the policy and our measures.
 */

export const BRUSSELS_TZ = 'Europe/Brussels'

const log = childLogger({ module: 'irail' })

// --------------------------------------------------------------------------
// Rate limiting — token bucket, 2 req/s with burst 4 (policy allows 3/s + 5)
// --------------------------------------------------------------------------

class TokenBucket {
  private tokens: number
  private lastRefill: number

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill()
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSecond) * 1000)
      await sleep(Math.max(waitMs, 10))
    }
  }

  private refill(): void {
    const now = Date.now()
    const elapsedSeconds = (now - this.lastRefill) / 1000
    if (elapsedSeconds <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond)
    this.lastRefill = now
  }
}

/** One shared bucket per process — the reason the worker is a single long-lived process (ADR 0002). */
const bucket = new TokenBucket(4, 2)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --------------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------------

export class IRailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly endpoint?: string,
  ) {
    super(message)
    this.name = 'IRailError'
  }
}

/** Thrown when a response does not match the schema. We never guess at missing fields. */
export class IRailSchemaError extends IRailError {
  constructor(endpoint: string, readonly issues: z.ZodIssue[]) {
    super(`iRail response failed validation for ${endpoint}`, undefined, endpoint)
    this.name = 'IRailSchemaError'
  }
}

// --------------------------------------------------------------------------
// Date helpers — always Europe/Brussels (docs/irail.md § Tijdzone)
// --------------------------------------------------------------------------

/** iRail wants DDMMYY, in Belgian local time. */
export function toIRailDate(date: Date): string {
  const brussels = new TZDate(date, BRUSSELS_TZ)
  const dd = String(brussels.getDate()).padStart(2, '0')
  const mm = String(brussels.getMonth() + 1).padStart(2, '0')
  const yy = String(brussels.getFullYear() % 100).padStart(2, '0')
  return `${dd}${mm}${yy}`
}

/** iRail wants HHMM, in Belgian local time. */
export function toIRailTime(date: Date): string {
  const brussels = new TZDate(date, BRUSSELS_TZ)
  return `${String(brussels.getHours()).padStart(2, '0')}${String(
    brussels.getMinutes(),
  ).padStart(2, '0')}`
}

/** The Belgian calendar day, as `YYYY-MM-DD`. This is `service_date`. */
export function toServiceDate(date: Date): string {
  const brussels = new TZDate(date, BRUSSELS_TZ)
  return `${brussels.getFullYear()}-${String(brussels.getMonth() + 1).padStart(2, '0')}-${String(
    brussels.getDate(),
  ).padStart(2, '0')}`
}

// --------------------------------------------------------------------------
// Core request
// --------------------------------------------------------------------------

const MAX_ATTEMPTS = 3
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

function userAgent(): string {
  const env = getEnv()
  return `RailClaim/0.1 (${env.APP_URL}; ${env.IRAIL_CONTACT_EMAIL})`
}

async function request<T>(
  endpoint: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const env = getEnv()
  const url = new URL(`${env.IRAIL_BASE_URL}/${endpoint}`)
  for (const [k, v] of Object.entries({ ...params, format: 'json' })) {
    url.searchParams.set(k, v)
  }

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await bucket.take()

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(response.headers.get('retry-after'))
          const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2 ** attempt * 500 + Math.random() * 250
          log.warn(
            { endpoint, status: response.status, attempt, backoffMs },
            'iRail request failed, backing off',
          )
          await sleep(backoffMs)
          continue
        }
        throw new IRailError(
          `iRail returned HTTP ${response.status}`,
          response.status,
          endpoint,
        )
      }

      const json: unknown = await response.json()
      const parsed = schema.safeParse(json)
      if (!parsed.success) {
        // Deliberately loud: a shape change must never be papered over, because
        // the downstream consumer decides whether someone gets compensated.
        log.error(
          { endpoint, issues: parsed.error.issues.slice(0, 5) },
          'iRail response failed schema validation',
        )
        throw new IRailSchemaError(endpoint, parsed.error.issues)
      }

      return parsed.data
    } catch (error) {
      lastError = error
      if (error instanceof IRailSchemaError) throw error
      if (attempt >= MAX_ATTEMPTS) break
      const backoffMs = 2 ** attempt * 500 + Math.random() * 250
      log.warn({ endpoint, attempt, err: String(error) }, 'iRail request errored, retrying')
      await sleep(backoffMs)
    }
  }

  throw lastError instanceof IRailError
    ? lastError
    : new IRailError(`iRail request failed: ${String(lastError)}`, undefined, endpoint)
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

let stationCache: { at: number; stations: StationInfo[] } | null = null
const STATION_TTL_MS = 24 * 60 * 60 * 1000

/** Full station list, cached 24h (docs/irail.md). ~714 stations. */
export async function getStations(lang: 'nl' | 'fr' = 'nl'): Promise<StationInfo[]> {
  if (stationCache && Date.now() - stationCache.at < STATION_TTL_MS) {
    return stationCache.stations
  }
  const data = await request('stations/', { lang }, stationsResponseSchema)
  stationCache = { at: Date.now(), stations: data.station }
  return data.station
}

export function clearStationCache(): void {
  stationCache = null
}

/**
 * Connections between two stations. Used once per route per day to pin down
 * which concrete train the user's preferred departure time corresponds to.
 */
export async function getConnections(options: {
  fromStationId: string
  toStationId: string
  date: Date
  timesel?: 'departure' | 'arrival'
  results?: number
  lang?: 'nl' | 'fr'
}): Promise<Connection[]> {
  const data = await request(
    'connections/',
    {
      from: options.fromStationId,
      to: options.toStationId,
      date: toIRailDate(options.date),
      time: toIRailTime(options.date),
      timesel: options.timesel ?? 'departure',
      results: String(options.results ?? 6),
      lang: options.lang ?? 'nl',
      typeOfTransport: 'trains',
    },
    connectionsResponseSchema,
  )
  return data.connection
}

/**
 * All stops of one train on one service date, with per-stop arrival delay.
 * This is what we read the compensation-relevant delay from.
 *
 * @param vehicleId e.g. `BE.NMBS.IC527`
 */
export async function getVehicle(
  vehicleId: string,
  serviceDate: Date,
  lang: 'nl' | 'fr' = 'nl',
): Promise<VehicleResponse> {
  return request(
    'vehicle/',
    { id: vehicleId, date: toIRailDate(serviceDate), lang, alerts: 'true' },
    vehicleResponseSchema,
  )
}
