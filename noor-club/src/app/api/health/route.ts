import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness plus a real database round trip.
 *
 * Deliberately says nothing about *which* database, which host, or which
 * version of anything third-party — an unauthenticated endpoint is not the
 * place to describe your infrastructure. `VERCEL_GIT_COMMIT_SHA` is public
 * information anyway once the app is deployed.
 */
export async function GET() {
  const startedAt = Date.now();

  let database: "ok" | "unreachable" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }

  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    latencyMs: Date.now() - startedAt,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: database === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
