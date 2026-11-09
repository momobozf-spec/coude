import { randomBytes } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { getEnv } from '@/lib/env'
import { safeEquals } from '@/lib/hash'
import { createLogger } from '@/lib/logger'
import { bootstrapSources, tick } from '@/jobs/scheduler'

export const dynamic = 'force-dynamic'
// Een ronde kan meerdere bronnen ophalen; de standaardlimiet van 15 seconden
// is daarvoor krap.
export const maxDuration = 60

const logger = createLogger({ component: 'cron-route' })

/**
 * Eén ronde draaien via HTTP.
 *
 * Bedoeld voor omgevingen waar geen langdraaiend proces past (Vercel Cron,
 * Cloud Scheduler). `npm run worker` blijft de bedoelde manier: die reageert
 * binnen een seconde op nieuw aanbod, terwijl een cron-route op zijn beste
 * hooguit elke minuut draait — en dit product verkoopt juist die seconden.
 *
 * ─── BEVEILIGING ────────────────────────────────────────────────────────────
 *
 * Zonder `CRON_SECRET` bestaat de route niet (404, niet 401): een 401 zou
 * verklappen dat het endpoint er is. Met secret wordt de header in constante
 * tijd vergeleken.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = getEnv()

  if (env.CRON_SECRET.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!safeEquals(provided, env.CRON_SECRET)) {
    logger.warn('Cron-route aangeroepen met een verkeerd secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await bootstrapSources()
    const result = await tick(`cron-${randomBytes(4).toString('hex')}`)

    return NextResponse.json({
      claimed: result.claimed,
      alertsRetried: result.alertsRetried,
      runs: result.runs.map((run) => ({
        source: run.sourceKey,
        status: run.status,
        fetched: run.fetched,
        created: run.created,
        duplicates: run.duplicates,
        qualified: run.qualified,
        alertsSent: run.alertsSent,
        durationMs: run.durationMs,
      })),
    })
  } catch (error) {
    logger.error('Cron-ronde mislukt', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Ronde mislukt' }, { status: 500 })
  }
}
