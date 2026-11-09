/**
 * Health check voor de container en de loadbalancer.
 *
 * Bewust géén versienummer, geen databasenaam en geen configuratie in het
 * antwoord: dit endpoint is publiek en hoeft alleen te zeggen of de applicatie
 * de database bereikt.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 })
  }
}
