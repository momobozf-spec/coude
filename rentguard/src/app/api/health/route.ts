import { NextResponse } from 'next/server';

/** Liveness-check voor de hosting. Bevat geen configuratie of geheimen. */
export function GET() {
  return NextResponse.json(
    { status: 'ok', time: new Date().toISOString() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
