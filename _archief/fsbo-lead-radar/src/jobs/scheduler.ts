/**
 * De scheduler: welke bron is aan de beurt, en hoeveel tegelijk.
 *
 * ─── WAAROM GEEN BULLMQ / REDIS ──────────────────────────────────────────────
 *
 * Een wachtrij-server zou hier een tweede stuk infrastructuur zijn voor een
 * probleem dat we al hebben opgelost: PostgreSQL kan atomair claimen (zie
 * `claimDueSources`), en dat is het enige wat een wachtrij hier zou doen. De
 * MVP draait dus op één tabel minder.
 *
 * De vorm is wél die van een wachtrij, met een expliciete claim en een
 * verlopende lock. Groeit het aantal bronnen zo dat één proces het niet meer
 * trekt, dan is de stap naar meerdere workers gratis: ze claimen gewoon
 * verschillende bronnen. En de stap naar BullMQ is dan een implementatiedetail
 * achter dezelfde `tick()`.
 *
 * ─── HOE HET NIET BLOKKEERT ──────────────────────────────────────────────────
 *
 * Elke tick claimt maximaal `COLLECTOR_CONCURRENCY` bronnen en draait ze
 * parallel met `Promise.allSettled`. Eén trage bron houdt de andere dus niet
 * tegen, en een bron die vastloopt raakt zijn lock kwijt na de lockduur —
 * waarna een volgende tick hem weer oppakt.
 */
import { allCollectors, allowedCollectors, getCollector } from '@/collectors/registry'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import {
  claimDueSources,
  releaseSource,
  syncSourceRegistry,
  updateSourceSettings,
} from '@/repositories/sourceRepository'
import { retryFailedAlerts } from '@/services/alertService'

import { runCollector, type RunSummary } from './runCollector'

const logger = createLogger({ component: 'scheduler' })

export interface TickResult {
  claimed: number
  runs: RunSummary[]
  alertsRetried: number
}

/**
 * Eén ronde. Aanroepbaar vanuit de worker, vanuit de CLI en vanuit de
 * cron-route — dezelfde code, drie manieren om hem te starten.
 */
export async function tick(workerId: string): Promise<TickResult> {
  const env = getEnv()
  const now = new Date()

  const allowed = allowedCollectors()
  if (allowed.length === 0) {
    logger.warn('Geen enkele bron staat in COLLECTOR_ENABLED_SOURCES')
    return { claimed: 0, runs: [], alertsRetried: 0 }
  }

  const sources = await claimDueSources({
    workerId,
    now,
    // De lock moet langer staan dan een run kan duren, anders pakt een tweede
    // worker de bron op terwijl de eerste nog bezig is.
    lockDurationMs: 10 * 60_000,
    allowedKeys: allowed.map((collector) => collector.key),
    limit: env.COLLECTOR_CONCURRENCY,
  })

  if (sources.length === 0) {
    // Ook zonder werk: mislukte berichten alsnog proberen. Een makelaar wiens
    // chat even onbereikbaar was hoort zijn lead te krijgen zodra dat kan.
    const retry = await retryFailedAlerts()
    return { claimed: 0, runs: [], alertsRetried: retry.retried }
  }

  logger.info('Bronnen geclaimd', { count: sources.length, keys: sources.map((s) => s.key) })

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const collector = getCollector(source.key)
      if (!collector) {
        // Kan gebeuren na het verwijderen van een collector waarvan de rij nog
        // bestaat. Slot teruggeven en doorgaan.
        logger.warn('Bron heeft geen collector meer', { key: source.key })
        await releaseSource(source.id)
        return null
      }
      return runCollector(source, collector)
    }),
  )

  const runs: RunSummary[] = []
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value !== null) {
      runs.push(outcome.value)
    } else if (outcome.status === 'rejected') {
      // `runCollector` vangt zijn eigen fouten af; komt er tóch iets door, dan
      // is dat een bug in de foutafhandeling zelf en willen we hem zien.
      logger.error('Onverwachte fout in een collector-run', {
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      })
    }
  }

  const retry = await retryFailedAlerts()

  return { claimed: sources.length, runs, alertsRetried: retry.retried }
}

/**
 * Zorgt dat elke geregistreerde collector een bronrij heeft en dat de bronnen
 * uit de env-allowlist aanstaan.
 *
 * ─── WAAROM ÁLLE COLLECTORS EEN RIJ KRIJGEN ──────────────────────────────────
 *
 * Ook de collectors die niet in de allowlist staan. Anders zou een bron die
 * bewust uit staat helemaal niet in het dashboard verschijnen, en kan een
 * beheerder niet zien dát hij bestaat, laat staan waarom hij niet draait. De
 * bronnenpagina toont per bron of hij in de allowlist zit; daarvoor moet de rij
 * er zijn.
 *
 * Aanzetten gebeurt alleen voor de toegestane bronnen, en alleen bij de
 * allereerste aanmaak. Op een verse database werkt `npm run worker` daarmee
 * meteen, zonder eerst vinkjes te zetten; en een bron die je later in het
 * dashboard uitzet blijft uit, ook na een herstart.
 */
export async function bootstrapSources(): Promise<void> {
  const rows = await syncSourceRegistry(allCollectors())
  const env = getEnv()

  for (const row of rows) {
    if (row.enabled) continue
    if (!env.COLLECTOR_ENABLED_SOURCES.includes(row.key)) continue
    // Alleen bij de allereerste aanmaak aanzetten. Heeft de bron al gedraaid,
    // dan is `enabled: false` een bewuste keuze in het dashboard geweest.
    if (row.lastRunAt !== null) continue

    await updateSourceSettings(row.key, { enabled: true })
    logger.info('Bron aangezet op basis van COLLECTOR_ENABLED_SOURCES', { key: row.key })
  }
}
