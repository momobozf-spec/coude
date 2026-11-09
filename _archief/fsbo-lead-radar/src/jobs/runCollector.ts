/**
 * Eén collector-run, van begin tot eind.
 *
 * Alles wat een run robuust maakt zit hier: een harde tijdslimiet, retries met
 * exponentiële backoff, een CollectorRun-rij die het resultaat vasthoudt, en
 * een gezondheidsupdate op de bron. Elke run is volledig afgeschermd — een
 * exception komt nooit buiten deze functie, want de scheduler moet doorgaan met
 * de andere bronnen.
 */
import { HttpClient } from '@/collectors/base/httpClient'
import type { CollectorDefinition } from '@/collectors/types'
import { getEnv } from '@/lib/env'
import { errorKindOf, isRetryable, messageOf } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import {
  finishRun,
  recordFailure,
  recordSuccess,
  releaseSource,
  startRun,
  type SourceRow,
} from '@/repositories/sourceRepository'
import { ingestBatch } from '@/services/ingestionService'

/**
 * Bovengrens op wat één run mag opleveren. Beschermt tegen een bron die na een
 * wijziging opeens zijn volledige archief teruggeeft: dan zou één run duizenden
 * "nieuwe" advertenties opleveren en evenzoveel alerts.
 */
const MAX_ITEMS_PER_RUN = 200

/** Een run die langer duurt dan dit is stuk, hoe hij ook eindigt. */
function runTimeoutMs(source: SourceRow): number {
  // Ruim boven de HTTP-timeout: een collector doet meerdere requests, en de
  // rate limiter kan er nog wachttijd bij optellen.
  return Math.max(60_000, source.timeoutMs * 10)
}

export interface RunSummary {
  sourceKey: string
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  fetched: number
  created: number
  duplicates: number
  qualified: number
  alertsSent: number
  alertsSuppressed: number
  durationMs: number
  error?: string
}

export async function runCollector(
  source: SourceRow,
  collector: CollectorDefinition,
): Promise<RunSummary> {
  const env = getEnv()
  const logger = createLogger({ component: 'collector', source: source.key })
  const startedAt = new Date()
  const runId = await startRun(source.id, 1)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), runTimeoutMs(source))

  const http = new HttpClient({
    userAgent: env.COLLECTOR_USER_AGENT,
    maxRequestsPerMinute: env.COLLECTOR_MAX_REQUESTS_PER_MINUTE,
    timeoutMs: source.timeoutMs,
    maxRetries: source.maxRetries,
    logger,
  })

  if (source.baseUrl) {
    try {
      http.configureHost(new URL(source.baseUrl).host, source.rateLimitPerMinute)
    } catch {
      // Een onbruikbare baseUrl is geen reden om de run te stoppen; de
      // collector bepaalt zijn URL's zelf en de globale limiet geldt sowieso.
      logger.warn('baseUrl van de bron is geen geldige URL', { baseUrl: source.baseUrl })
    }
  }

  try {
    // ── Ophalen, met retries op tijdelijke fouten ───────────────────────────
    let attempt = 0
    let collected: Awaited<ReturnType<CollectorDefinition['collect']>> | null = null
    let lastError: unknown = null

    while (attempt <= source.maxRetries) {
      try {
        collected = await collector.collect({
          http,
          logger,
          lastSuccessAt: source.lastSuccessAt,
          maxItems: MAX_ITEMS_PER_RUN,
          signal: controller.signal,
        })
        break
      } catch (error) {
        lastError = error
        // Een verbod of een blokkade is geen tijdelijke storing. Nog eens
        // proberen zou precies het gedrag zijn dat we niet willen vertonen.
        if (!isRetryable(error) || attempt === source.maxRetries) break

        const backoffMs = Math.min(30_000, 1_000 * 2 ** attempt)
        logger.warn('Collector faalde, opnieuw proberen', {
          attempt: attempt + 1,
          backoffMs,
          error: messageOf(error),
        })
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        attempt += 1
      }
    }

    if (collected === null) {
      throw lastError instanceof Error ? lastError : new Error('Collector gaf geen resultaat')
    }

    // ── Verwerken ───────────────────────────────────────────────────────────
    const batch = await ingestBatch(collected.listings, {
      sourceId: source.id,
      sourceName: source.name,
      logger,
      sendAlerts: true,
    })

    const warnings = [...collected.warnings, ...batch.errors]
    const status = warnings.length > 0 || batch.rejected > 0 ? 'PARTIAL' : 'SUCCESS'

    await finishRun(
      runId,
      {
        status,
        itemsFetched: batch.fetched,
        itemsNew: batch.created,
        itemsUpdated: batch.updated,
        itemsUnchanged: batch.unchanged,
        itemsDuplicate: batch.duplicates,
        itemsRejected: batch.rejected,
        leadsQualified: batch.qualified,
        alertsSent: batch.alertsSent,
        alertsSuppressed: batch.alertsSuppressed,
        error: warnings.length > 0 ? warnings.slice(0, 5).join(' | ').slice(0, 1000) : undefined,
      },
      startedAt,
    )

    await recordSuccess(source.id, new Date())

    logger.info('Run afgerond', {
      status,
      fetched: batch.fetched,
      created: batch.created,
      duplicates: batch.duplicates,
      qualified: batch.qualified,
      alertsSent: batch.alertsSent,
      alertsSuppressed: batch.alertsSuppressed,
    })

    return {
      sourceKey: source.key,
      status,
      fetched: batch.fetched,
      created: batch.created,
      duplicates: batch.duplicates,
      qualified: batch.qualified,
      alertsSent: batch.alertsSent,
      alertsSuppressed: batch.alertsSuppressed,
      durationMs: Date.now() - startedAt.getTime(),
    }
  } catch (error) {
    const kind = errorKindOf(error)
    const message = messageOf(error)

    await finishRun(
      runId,
      {
        status: 'FAILED',
        itemsFetched: 0,
        itemsNew: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
        itemsDuplicate: 0,
        itemsRejected: 0,
        leadsQualified: 0,
        alertsSent: 0,
        alertsSuppressed: 0,
        errorKind: kind,
        error: message.slice(0, 1000),
      },
      startedAt,
    )

    const health = await recordFailure({
      sourceId: source.id,
      at: new Date(),
      errorKind: kind,
      message,
      cooldownMinutes: env.COLLECTOR_COOLDOWN_MINUTES,
    })

    logger.error('Run mislukt', { kind, error: message, ...health })

    return {
      sourceKey: source.key,
      status: 'FAILED',
      fetched: 0,
      created: 0,
      duplicates: 0,
      qualified: 0,
      alertsSent: 0,
      alertsSuppressed: 0,
      durationMs: Date.now() - startedAt.getTime(),
      error: message,
    }
  } finally {
    clearTimeout(timeout)
    // `recordSuccess`/`recordFailure` geven het slot al terug; deze regel dekt
    // het pad waarop geen van beide is gelopen (een fout in het loggen zelf).
    await releaseSource(source.id).catch(() => undefined)
  }
}
