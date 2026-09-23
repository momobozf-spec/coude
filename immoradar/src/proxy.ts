import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/health", "/api/jobs"];

/**
 * Cheap gate: redirect anonymous requests to the login page. Real session
 * validation and tenant scoping happen server-side in layouts and actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
