import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/color", "/academy/learn", "/academy/my-courses", "/academy/certificate", "/ramadan-challenge/dashboard", "/ramadan-challenge/day", "/ramadan-challenge/certificate", "/sell/dashboard", "/sell/upload", "/white-label/setup", "/school"];
const authRoutes = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for session token (NextAuth stores it as a cookie)
  const token =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const isAuthenticated = !!token;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname === route);

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/color/:path*", "/academy/learn/:path*", "/academy/my-courses/:path*", "/academy/certificate/:path*", "/ramadan-challenge/dashboard/:path*", "/ramadan-challenge/day/:path*", "/ramadan-challenge/certificate/:path*", "/sell/dashboard/:path*", "/sell/upload/:path*", "/white-label/setup/:path*", "/school/:path*", "/login", "/register"],
};
