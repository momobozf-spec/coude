import { NextResponse } from 'next/server'

import { getEnv, getIntegrationStatus } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness probe.
 *
 * Reports which integrations are actually configured. It never claims a
 * dependency is healthy that has not been checked, and it never leaks a
 * credential — only booleans.
 */
export async function GET() {
  try {
    const env = getEnv()
    const integrations = getIntegrationStatus(env)

    return NextResponse.json(
      {
        status: 'ok',
        service: 'railclaim-web',
        environment: env.NODE_ENV,
        time: new Date().toISOString(),
        integrations,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    // A missing/invalid env is a genuine failure — report it as unhealthy
    // rather than pretending the service is up.
    return NextResponse.json(
      {
        status: 'error',
        service: 'railclaim-web',
        message: error instanceof Error ? error.message : 'configuration error',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
