import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/routing";
import { isLocale } from "@/lib/locales";

const intlMiddleware = createMiddleware(routing);

/** First path segment (after the locale) that requires a signed-in parent. */
const PROTECTED_SECTIONS = new Set([
  "kinderen",
  "kind",
  "pakket",
  "spel",
  "paspoort",
  "ouder",
  "account",
]);

/**
 * Auth.js v5 cookie names. We only check for *presence* here — verifying the
 * JWT would pull crypto into the edge runtime for no benefit, because every
 * protected page still calls `requireUser()`, which validates the session for
 * real. This check exists purely so a logged-out visitor lands on /login
 * instead of watching a dashboard flash and disappear.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function middleware(request: NextRequest) {
  // Server Action POSTs must pass through untouched. The i18n middleware is
  // built for navigation requests: run it on an action and it rewrites the
  // action's response, turning the `x-action-redirect` header into a plain 303
  // that React's action fetch does not follow — the form then hangs on
  // "pending" forever while the mutation has actually succeeded.
  // Locale is carried explicitly by the actions themselves, so nothing is lost.
  if (request.method === "POST" && request.headers.has("next-action")) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  const first = segments[0];
  const hasLocalePrefix = isLocale(first);
  const locale = hasLocalePrefix && first ? first : routing.defaultLocale;
  const section = hasLocalePrefix ? segments[1] : segments[0];

  if (section && PROTECTED_SECTIONS.has(section)) {
    const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!signedIn) {
      const url = new URL(`/${locale}/login`, request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
