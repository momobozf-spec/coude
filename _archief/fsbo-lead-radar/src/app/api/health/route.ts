import { NextResponse } from 'next/server'

import { prisma } from '@/repositories/prisma'

export const dynamic = 'force-dynamic'

/**
 * Healthcheck voor de container en de loadbalancer.
 *
 * Bewust zonder authenticatie en bewust zonder details: hij zegt of de app haar
 * database kan bereiken, en verder niets. Aantallen leads of bronnamen zouden
 * hier bedrijfsinformatie op een open endpoint zetten.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 })
  }
}
