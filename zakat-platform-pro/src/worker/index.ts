import 'dotenv/config'

import { assertProductionConfig, serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { prisma } from '@/server/db/prisma'
import { priceStatus, syncEcbRates } from '@/server/modules/prices/service'
import { processDueReminders } from '@/server/modules/reminders/processor'

/**
 * Achtergrondprocessen. Eén instantie per installatie (`npm run worker`).
 *
 *  • elke minuut: herinneringen die aan de beurt zijn (in-app + e-mail);
 *  • elk uur: ECB-koersen ophalen als FX_SYNC=frankfurter, en waarschuwen
 *    als een gepubliceerde prijs ontbreekt of te oud is;
 *  • elke dag: verlopen herstellinks opruimen.
 *
 * Twee instanties tegelijk zijn veilig (de herinneringen zijn idempotent),
 * maar onnodig. Elke taak vangt haar eigen fouten op: één mislukte ronde mag
 * de volgende niet tegenhouden.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

let stopping = false
const timers: Array<ReturnType<typeof setInterval>> = []
const running = new Set<string>()

async function guarded(name: string, task: () => Promise<void>): Promise<void> {
  if (stopping || running.has(name)) return
  running.add(name)
  try {
    await task()
  } catch (error) {
    logger.error('worker.task_failed', {
      task: name,
      message: error instanceof Error ? error.message : 'unknown',
    })
  } finally {
    running.delete(name)
  }
}

async function reminders(): Promise<void> {
  // Achterstand inhalen in meerdere batches, maar nooit eindeloos.
  for (let round = 0; round < 10; round += 1) {
    const result = await processDueReminders(new Date())
    if (result.examined < 200) return
  }
}

async function prices(): Promise<void> {
  if (serverEnv().FX_SYNC === 'frankfurter') {
    const result = await syncEcbRates()
    logger.info('worker.ecb_synced', {
      published: result.published.length,
      missing: result.missing.join(','),
    })
  }

  const stale = (await priceStatus()).filter((row) => row.stale)
  if (stale.length > 0) {
    logger.warn('worker.prices_stale', {
      count: stale.length,
      which: stale.map((row) => `${row.kind}:${row.currency}`).join(','),
    })
  }
}

async function cleanup(): Promise<void> {
  const removed = await prisma.verificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  })
  logger.info('worker.cleanup', { verificationTokens: removed.count })
}

function every(ms: number, name: string, task: () => Promise<void>): void {
  void guarded(name, task)
  timers.push(setInterval(() => void guarded(name, task), ms))
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return
  stopping = true
  logger.info('worker.stopping', { signal })
  for (const timer of timers) clearInterval(timer)

  const deadline = Date.now() + 25_000
  while (running.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  await prisma.$disconnect()
  process.exit(0)
}

function main(): void {
  try {
    assertProductionConfig()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  logger.info('worker.started', { fxSync: serverEnv().FX_SYNC })
  every(MINUTE, 'reminders', reminders)
  every(HOUR, 'prices', prices)
  every(DAY, 'cleanup', cleanup)
}

main()
