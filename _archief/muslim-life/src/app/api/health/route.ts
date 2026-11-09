import { NextResponse } from 'next/server'

/**
 * Liveness.
 *
 * "Is this process running and able to answer?" — nothing more. It must not
 * touch the database: a load balancer that pulls a healthy instance because
 * Postgres blinked turns a degraded system into an outage.
 *
 * Readiness, which does check dependencies, is `/api/ready`.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  )
}
