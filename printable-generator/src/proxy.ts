import { NextRequest, NextResponse } from "next/server";
import { disabledFeatureForPath } from "@/lib/features";

// Pages that need a session cookie. NOTE: this is only a UX redirect — every API route
// and server action does its own auth() / role check (see src/lib/authz.ts).
const protectedRoutes = [
  "/dashboard",
  "/color",
  "/admin",
  "/academy/learn",
  "/academy/my-courses",
  "/academy/certificate",
  "/ramadan-challenge/dashboard",
  "/ramadan-challenge/day",
  "/ramadan-challenge/certificate",
  "/sell/dashboard",
  "/sell/upload",
  "/white-label/setup",
  "/school",
];
const authRoutes = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Optional modules that are switched off → behave as if they don't exist.
  if (disabledFeatureForPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.rewrite(new URL("/not-found-feature", req.nextUrl.origin), { status: 404 });
  }

  const token =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;
  const isAuthenticated = !!token;

  const isProtected = protectedRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authRoutes.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|woff2?)$).*)"],
};
