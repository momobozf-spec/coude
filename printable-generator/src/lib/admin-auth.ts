import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Shared admin check for every /api/admin route.
// Fails closed: without an ADMIN_PASSWORD of at least 16 characters nobody is admin
// (previously `undefined === undefined` let every request through).
export function isAdminRequest(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers.get("x-admin-password");
  if (!expected || expected.length < 16 || !given) return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
