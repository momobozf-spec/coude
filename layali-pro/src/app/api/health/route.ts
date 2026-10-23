import { NextResponse } from "next/server";

/** Leeft het proces? Raakt de database niet. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}

export const dynamic = "force-dynamic";
