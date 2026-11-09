/**
 * Route-bescherming vóór de render. Heette tot Next 15 `middleware.ts`; sinds
 * Next 16 is de bestandsnaam `proxy.ts` en de exportnaam `proxy`.
 *
 * Dit is de tweede laag, niet de enige. De echte controle staat in
 * `(dashboard)/layout.tsx` en in elke repository-functie: deze laag ziet alleen
 * of er een sessiecookie is, niet of die gebruiker bij déze data mag. Een
 * cookie die bestaat, is geen bewijs dat hij geldig is — dat controleert
 * Auth.js pas server-side.
 *
 * De reden dat hij er toch staat: hij scheelt een volledige serverrender voor
 * iemand die niet is ingelogd, en hij vangt een pagina op die iemand ooit buiten
 * de `(dashboard)`-groep aanmaakt.
 */
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/journey',
  '/search',
  '/saved',
  '/financing',
  '/documents',
  '/checklist',
  '/neighborhood',
  '/assistant',
  '/profile',
  '/onboarding',
]

/**
 * De naam van de sessiecookie verschilt tussen http en https: Auth.js gebruikt
 * het `__Secure-`-voorvoegsel zodra de verbinding beveiligd is.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (!isProtected) return NextResponse.next()

  if (!hasSessionCookie(request)) {
    const login = new URL('/login', request.url)
    // Zo komt de gebruiker na het inloggen terug waar hij heen wilde.
    login.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Alles behalve statische bestanden en de auth-endpoints zelf.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons).*)',
  ],
}
