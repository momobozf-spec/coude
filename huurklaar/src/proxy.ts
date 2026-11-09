import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, maxBodyBytes, sameOrigin } from "@/lib/security";

const LOCALES = ["nl", "fr"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Server-naar-server-endpoints met eigen authenticatie (geen browser, dus geen Origin).
const ORIGIN_EXEMPT = new Set(["/api/inbound", "/api/stripe/webhook"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/auth/");

  // 1) CSRF: state-wijzigende verzoeken moeten van onze eigen site komen.
  if (isApi && !SAFE_METHODS.has(request.method) && !ORIGIN_EXEMPT.has(pathname)) {
    const allowed = process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).origin] : [];
    if (!sameOrigin(request.headers.get("origin"), request.headers.get("referer"), request.headers.get("host"), allowed)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // 2) Te grote bodies meteen weigeren.
  if (isApi && !SAFE_METHODS.has(request.method)) {
    const len = Number(request.headers.get("content-length") ?? "0");
    if (len > maxBodyBytes(pathname)) return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // 3) Taal kiezen voor "/".
  if (pathname === "/") {
    const cookieLang = request.cookies.get("lang")?.value;
    const accept = request.headers.get("accept-language") ?? "";
    const lang = cookieLang && LOCALES.includes(cookieLang) ? cookieLang : /^fr\b/i.test(accept.trim()) ? "fr" : "nl";
    return NextResponse.redirect(new URL(`/${lang}`, request.url));
  }

  // 4) CSP met nonce voor pagina's. Next.js leest de nonce uit de request-header.
  const requestHeaders = new Headers(request.headers);
  let csp: string | null = null;
  if (!isApi) {
    const nonce = btoa(crypto.randomUUID());
    csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== "production", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }
  const next = () => {
    const r = NextResponse.next({ request: { headers: requestHeaders } });
    if (csp) r.headers.set("Content-Security-Policy", csp);
    return r;
  };

  // 5) Supabase-sessie verversen.
  let response = next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && !ORIGIN_EXEMPT.has(pathname)) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.cookies.toString());
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser().catch(() => null);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|\\.well-known|api/stripe/webhook).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
