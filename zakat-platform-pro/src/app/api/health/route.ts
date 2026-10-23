import { NextResponse } from 'next/server'

/**
 * Liveness: draait het webproces? Raakt de database bewust niet — een trage
 * database mag geen herstart van gezonde containers uitlokken. Voor "kan dit
 * proces requests bedienen" is er /api/ready.
 */
export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}

export const dynamic = 'force-dynamic'
