import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Klaar om verkeer te ontvangen: de database antwoordt. Gebruikt door Render als health check. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" });
  } catch (error) {
    console.error("[ready] database niet bereikbaar:", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
