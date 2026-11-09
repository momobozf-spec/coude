import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from '@auth/core/jwt'

/**
 * Route protection (Next.js 16 `proxy` convention, formerly `middleware`).
 *
 * This is the first gate, not the only one: every page calls
 * `requireActorOrRedirect()` and every service re-checks ownership. The proxy is
 * never treated as sufficient authorization on its own.
 *
 * `getToken` is used rather than the `auth()` helper so this stays on the Edge
 * runtime and never pulls Prisma into it.
 */

const AUTH_ROUTES = ['/login', '/register']

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/zakat',
  '/assets',
  '/donations',
  '/sadaqah',
  '/calendar',
  '/notifications',
  '/reports',
  '/family',
  '/profile',
]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const secureCookie = process.env.NODE_ENV === 'production'

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
    salt: secureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token',
  })

  const isSignedIn = Boolean(token)

  // Signed-in users have no reason to see login/register.
  if (isSignedIn && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (isProtected(pathname) && !isSignedIn) {
    const url = new URL('/login', request.url)
    url.searchParams.set('callbackUrl', pathname + search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, the manifest and the
     * auth API routes, which must stay reachable while signed out.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
