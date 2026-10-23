import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { DEFAULT_LOCALE, LOCALES, isLocale, localeFromAcceptLanguage } from '@/i18n/config';

/**
 * Doet twee dingen:
 *
 *  1. **Taal.** Elke pagina zit onder `/nl` of `/fr`. Wie zonder taalprefix
 *     binnenkomt, wordt doorgestuurd op basis van zijn browsertaal. De gekozen
 *     taal gaat als header mee naar de root layout, zodat `<html lang>` klopt.
 *  2. **Sessie.** De Supabase-sessie wordt ververst zodat server components een
 *     geldige sessie zien. Dit is de enige plek waar dat mag gebeuren.
 */

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];

  if (!isLocale(first)) {
    const locale = localeFromAcceptLanguage(
      request.headers.get('accept-language'),
    );
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = first;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Zonder Supabase-configuratie blijft de app bruikbaar voor publieke
  // pagina's in plaats van bij elk verzoek te crashen.
  if (!supabaseUrl || !anonKey) return response;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Ververst de sessie. Het resultaat wordt hier niet gebruikt: autorisatie
  // gebeurt per pagina, niet in de middleware.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export { LOCALES, DEFAULT_LOCALE };
