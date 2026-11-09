import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from '@auth/core/jwt'

/**
 * Route protection (Next.js 16 `proxy` convention, formerly `middleware`).
 *
 * This is the first gate, not the only one: every service re-checks ownership and
 * `requireAdmin()` runs again inside the admin layout. Middleware alone is never
 * treated as sufficient authorization.
 *
 * `getToken` is used rather than the `auth()` helper so this stays on the
 * Edge runtime and never pulls Prisma into it.
 */

const AUTH_ROUTES = ['/login', '/register']

function isProtected(pathname: string) {
  return pathname === '/app' || pathname.startsWith('/app/') || pathname === '/onboarding'
}

function isAdminRoute(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
    salt:
      process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
  })

  const isSignedIn = Boolean(token)

  // Signed-in users have no reason to see login/register.
  if (isSignedIn && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  if (isAdminRoute(pathname)) {
    if (!isSignedIn) return redirectToLogin(request, pathname + search)
    if (token?.role !== 'ADMIN') return NextResponse.redirect(new URL('/app', request.url))
    return NextResponse.next()
  }

  if (isProtected(pathname)) {
    if (!isSignedIn) return redirectToLogin(request, pathname + search)

    // Force onboarding before the app becomes usable, otherwise the dashboard has
    // no location and cannot compute prayer times.
    const onboarded = token?.onboarded === true
    if (!onboarded && pathname !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    if (onboarded && pathname === '/onboarding') {
      return NextResponse.redirect(new URL('/app', request.url))
    }
  }

  return NextResponse.next()
}

function redirectToLogin(request: NextRequest, callbackPath: string) {
  const url = new URL('/login', request.url)
  url.searchParams.set('callbackUrl', callbackPath)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, favicon and the auth
     * API routes (which must stay reachable while signed out).
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
