import { NextResponse, type NextRequest } from 'next/server'

import { appUrl } from '@/config/app-url'

export const dynamic = 'force-dynamic'

/**
 * Clear a session the server no longer honours.
 *
 * A JWT session stays cryptographically valid after a password change or an
 * account deletion; the server rejects it in `getActor`. Without this route the
 * member would bounce between /app (layout: "no actor → login") and /login
 * (proxy: "has a token → app"). Clearing the cookie breaks that loop.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', appUrl()))
  for (const cookie of request.cookies.getAll()) {
    if (/authjs\.session-token/.test(cookie.name)) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        secure: cookie.name.startsWith('__Secure-'),
      })
    }
  }
  return response
}
