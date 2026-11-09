import { NextResponse, type NextRequest } from 'next/server'

/**
 * Beschermt /admin. (Next 16 noemt deze laag `proxy`; het was `middleware`.)
 *
 * Deze laag doet bewust maar de helft van het werk: hij kijkt of er *een*
 * sessiecookie is, en stuurt anders naar de loginpagina. De handtekening wordt
 * hier niet gecontroleerd — dat gebeurt in `isAuthenticated()` op de pagina
 * zelf en in `requireAdmin()` in elke server action.
 *
 * Die verdeling is opzet, geen gemakzucht. De proxy draait op de Edge runtime,
 * waar `node:crypto` niet vanzelfsprekend is; de verificatie hier herhalen zou
 * een tweede implementatie van dezelfde controle betekenen, en twee
 * implementaties van een beveiligingscontrole lopen vroeg of laat uiteen.
 * Deze laag is dus een wegwijzer, niet het slot.
 */
const COOKIE_NAME = 'fsbo_admin'

/**
 * Zonder wachtwoord is er niets om naartoe door te sturen: `isAuthenticated()`
 * laat de bezoeker dan door (alleen buiten productie) en een redirect naar
 * /login zou een lus opleveren. De env wordt hier rechtstreeks gelezen omdat de
 * Zod-validatie uit `lib/env` niet op de Edge runtime hoort te draaien.
 */
function adminAuthConfigured(): boolean {
  return (
    (process.env.ADMIN_PASSWORD ?? '').length > 0 && (process.env.SESSION_SECRET ?? '').length >= 32
  )
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (!adminAuthConfigured()) return NextResponse.next()
  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
