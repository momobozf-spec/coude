/**
 * `npm run collect` — één ronde draaien en afsluiten.
 *
 * Bedoeld om te zien wat de pijplijn doet zonder een worker te laten staan, en
 * als entrypoint voor een externe scheduler (cron, Kubernetes CronJob) die
 * liever een proces start dan een HTTP-route aanroept.
 */
import { randomBytes } from 'node:crypto'

import 'dotenv/config'

import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/repositories/prisma'

import { bootstrapSources, tick } from './scheduler'

const logger = createLogger({ component: 'collect-cli' })

async function main(): Promise<void> {
  const env = getEnv()
  logger.info('Eenmalige ronde', { sources: env.COLLECTOR_ENABLED_SOURCES })

  await bootstrapSources()
  const result = await tick(`cli-${randomBytes(4).toString('hex')}`)

  if (result.runs.length === 0) {
    console.log('\nGeen bron was aan de beurt. Intervallen staan in het dashboard onder /admin/sources.')
  }

  for (const run of result.runs) {
    console.log(
      [
        `\n${run.sourceKey}: ${run.status} in ${run.durationMs} ms`,
        `  opgehaald ${run.fetched} · nieuw ${run.created} · duplicaat ${run.duplicates}`,
        `  gekwalificeerd ${run.qualified} · alerts verzonden ${run.alertsSent}` +
          (run.alertsSuppressed > 0 ? ` · onderdrukt ${run.alertsSuppressed} (dry-run of al verstuurd)` : ''),
        run.error ? `  fout: ${run.error}` : '',
      ]
        .filter((line) => line.length > 0)
        .join('\n'),
    )
  }

  await prisma.$disconnect()
}

main().catch((error: unknown) => {
  logger.error('Ronde mislukt', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exitCode = 1
})
