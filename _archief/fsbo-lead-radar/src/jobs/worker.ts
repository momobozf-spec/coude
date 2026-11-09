/**
 * Het worker-proces: `npm run worker`.
 *
 * Draait naast de webapp. Die scheiding is bewust — het dashboard mag herstart
 * of geschaald worden zonder dat er een collector-run halverwege afbreekt, en
 * een vastlopende collector mag geen webrequest ophouden.
 *
 * De lus is expres saai: elke seconde kijken of er werk is, en zo ja het doen.
 * De planning per bron zit in de database (`pollIntervalSeconds`), niet in een
 * timer hier, zodat een intervalwijziging in het dashboard meteen ingaat zonder
 * herstart.
 */
import { randomBytes } from 'node:crypto'
import os from 'node:os'

import 'dotenv/config'

import { assertProductionSecrets, getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/repositories/prisma'
import { purgeExpiredData } from '@/services/dataRetentionService'

import { bootstrapSources, tick } from './scheduler'

const logger = createLogger({ component: 'worker' })

const TICK_INTERVAL_MS = 1_000
/** Bewaartermijnen zijn in dagen; één keer per uur nakijken is ruim genoeg. */
const PURGE_INTERVAL_MS = 60 * 60_000

async function main(): Promise<void> {
  const env = getEnv()
  assertProductionSecrets(env)

  const workerId = `${os.hostname()}-${process.pid}-${randomBytes(3).toString('hex')}`
  logger.info('Worker gestart', {
    workerId,
    concurrency: env.COLLECTOR_CONCURRENCY,
    sources: env.COLLECTOR_ENABLED_SOURCES,
    telegram: env.TELEGRAM_BOT_TOKEN.length > 0 ? 'actief' : 'dry-run',
  })

  await bootstrapSources()

  let running = true
  let lastPurgeMs = Date.now()

  const shutdown = (signal: string): void => {
    if (!running) return
    running = false
    logger.info('Afsluitsignaal ontvangen, run afmaken', { signal })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  while (running) {
    try {
      const result = await tick(workerId)

      if (result.runs.length > 0) {
        logger.info('Tick afgerond', {
          claimed: result.claimed,
          alerts: result.runs.reduce((sum, run) => sum + run.alertsSent, 0),
          nieuw: result.runs.reduce((sum, run) => sum + run.created, 0),
        })
      }

      if (Date.now() - lastPurgeMs > PURGE_INTERVAL_MS) {
        lastPurgeMs = Date.now()
        await purgeExpiredData()
      }
    } catch (error) {
      // De lus mag nooit stoppen op een fout. Een database die even weg is
      // komt terug; een worker die afsloot niet.
      logger.error('Fout in de worker-lus', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    if (!running) break
    await new Promise((resolve) => setTimeout(resolve, TICK_INTERVAL_MS))
  }

  await prisma.$disconnect()
  logger.info('Worker gestopt')
  process.exit(0)
}

main().catch((error: unknown) => {
  logger.error('Worker kon niet starten', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
