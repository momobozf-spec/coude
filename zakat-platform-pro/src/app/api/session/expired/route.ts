import { NextResponse, type NextRequest } from 'next/server'

/**
 * Wist de sessiecookie en stuurt naar /login.
 *
 * Nodig omdat de proxy alleen de handtekening van de JWT controleert, niet of
 * de sessie intussen is ingetrokken. Zonder dit zou een ingetrokken cookie
 * eindeloos tussen /login en /dashboard heen en weer kaatsen.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?sessie=verlopen', request.url))

  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith('authjs.session-token') ||
      cookie.name.startsWith('__Secure-authjs.session-token')
    ) {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        secure: cookie.name.startsWith('__Secure-'),
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  }

  return response
}

export const dynamic = 'force-dynamic'
