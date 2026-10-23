import 'server-only'

import { isProduction, publicEnv, serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { prisma } from '@/server/db/prisma'

/**
 * Analytics sinks.
 *
 * The business layer (`src/server/services/analytics.ts`) owns the event
 * catalogue and the property types. This module owns *where the event goes*, and
 * nothing here knows what an event means.
 *
 * The default is `database`: our own table, in our own region. An external
 * provider is only ever contacted when one is deliberately configured.
 */

/** Values a sink may receive. Deliberately excludes arbitrary strings. */
export type SafeValue = number | boolean | null

export interface AnalyticsSink {
  readonly id: string
  record(
    userId: string | null,
    name: string,
    properties: Record<string, SafeValue>,
  ): Promise<void>
}

/**
 * Property names that must never carry data, whatever their type.
 *
 * The type system already forbids strings, which is the main defence. This is
 * the second layer, for the cases types cannot catch: a `number` named
 * `donationAmount` is still something we have decided not to collect.
 */
const FORBIDDEN_PROPERTY_NAMES = [
  'email',
  'name',
  'fullname',
  'phone',
  'address',
  'customerid',
  'subscriptionid',
  'priceid',
  'paymentmethod',
  'card',
  'prompt',
  'message',
  'content',
  'title',
  'query',
  'search',
  'note',
  'reflection',
  'amount',
  'price',
  'total',
  'ip',
  'useragent',
  'latitude',
  'longitude',
]

export class AnalyticsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalyticsValidationError'
  }
}

/**
 * Reject anything that must not be recorded.
 *
 * Throws rather than silently stripping: a developer adding `{ email }` to an
 * event should find out immediately, not ship a quietly-dropped field and
 * assume the data is arriving.
 */
export function assertSafeProperties(
  name: string,
  properties: Record<string, unknown>,
): asserts properties is Record<string, SafeValue> {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') {
      throw new AnalyticsValidationError(
        `Analytics event "${name}" property "${key}" is a string. Only numbers, booleans and null may be recorded.`,
      )
    }

    if (value !== null && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new AnalyticsValidationError(
        `Analytics event "${name}" property "${key}" has an unsupported type.`,
      )
    }

    const normalised = key.toLowerCase().replace(/[^a-z]/g, '')
    if (FORBIDDEN_PROPERTY_NAMES.includes(normalised)) {
      throw new AnalyticsValidationError(
        `Analytics event "${name}" property "${key}" is not collectable.`,
      )
    }
  }
}

/** Records nothing. The safe choice when analytics is switched off. */
export const noopSink: AnalyticsSink = {
  id: 'noop',
  async record() {
    // Intentionally empty.
  },
}

/** Prints events. Lets a developer watch the funnel without wiring a provider. */
export const consoleSink: AnalyticsSink = {
  id: 'console',
  async record(userId, name, properties) {
    logger.debug('analytics.event', {
      event: name,
      // The id itself is not printed: a log line is a much wider audience than
      // a database row, and `hasUser` answers every question we ask of a log.
      hasUser: userId !== null,
      ...properties,
    })
  },
}

/** Our own Postgres table, EU-resident with the rest of the data. */
export const databaseSink: AnalyticsSink = {
  id: 'database',
  async record(userId, name, properties) {
    await prisma.analyticsEvent.create({ data: { userId, name, properties } })
  },
}

/**
 * PostHog, over the capture endpoint.
 *
 * No SDK, for the same reason as the other integrations: one dependency fewer,
 * and the request body is visible in this file. The member is identified by
 * their internal id only — never an email, never a name — so a PostHog profile
 * cannot be resolved to a person without our own database.
 */
export function createPostHogSink(apiKey: string, host: string): AnalyticsSink {
  const endpoint = `${host.replace(/\/+$/, '')}/capture/`

  return {
    id: 'posthog',
    async record(userId, name, properties) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          event: name,
          // Anonymous events still need a distinct id; a stable constant keeps
          // them aggregated without inventing a fake person.
          distinct_id: userId ?? 'anonymous',
          properties: {
            ...properties,
            // Tells PostHog not to build a person profile from anonymous events.
            $process_person_profile: userId !== null,
          },
        }),
        signal: AbortSignal.timeout(5_000),
      })

      if (!response.ok) {
        throw new Error(`PostHog rejected the event (${response.status})`)
      }
    },
  }
}

export type AnalyticsProviderId = 'noop' | 'console' | 'database' | 'posthog'

let cached: AnalyticsSink | null = null

function resolve(): AnalyticsSink {
  const provider = serverEnv().ANALYTICS_PROVIDER

  switch (provider) {
    case 'noop':
      return noopSink

    case 'console':
      // Never in production: it would put event streams into the log pipeline,
      // which is retained differently and read by more people.
      return isProduction ? databaseSink : consoleSink

    case 'posthog': {
      const key = publicEnv.NEXT_PUBLIC_POSTHOG_KEY
      if (!key) {
        // Not a silent external send, and not a silent drop either: say so once
        // and keep the events in the place they would otherwise have gone.
        logger.warn('analytics.posthog.not_configured')
        return databaseSink
      }
      return createPostHogSink(key, publicEnv.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com')
    }

    case 'database':
      return databaseSink
  }
}

export function getAnalyticsSink(): AnalyticsSink {
  cached ??= resolve()
  return cached
}

/** Status for the admin panel and the readiness endpoint. */
export function getAnalyticsStatus(): { providerId: AnalyticsProviderId; sinkId: string } {
  return { providerId: serverEnv().ANALYTICS_PROVIDER, sinkId: getAnalyticsSink().id }
}

/** Test seam. `null` restores environment-driven resolution. */
export function setAnalyticsSinkOverride(sink: AnalyticsSink | null) {
  cached = sink
}
