import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/hash";
import { createLogger } from "@/lib/logger";
import { runCollectJob, runDigestJob, runLeadReviveJob, runRetentionJob } from "@/jobs/pipeline";

const log = createLogger({ component: "jobs-api" });
const jobSchema = z.enum(["collect", "leadrevive", "digest", "retention", "all"]);

/**
 * Cron entry point. Protect with `Authorization: Bearer <CRON_SECRET>`.
 * Example: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://host/api/jobs/collect
 */
export async function POST(request: NextRequest, context: { params: Promise<{ job: string }> }) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !safeEqual(token, getEnv().CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job: raw } = await context.params;
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const job = parsed.data;
  const force = request.nextUrl.searchParams.get("force") === "1";
  const started = Date.now();
  try {
    const result: Record<string, unknown> = {};
    if (job === "collect" || job === "all") result["collect"] = await runCollectJob(db);
    if (job === "leadrevive" || job === "all") result["leadrevive"] = await runLeadReviveJob(db);
    if (job === "digest" || job === "all") result["digest"] = await runDigestJob(db, { force });
    if (job === "retention") result["retention"] = await runRetentionJob(db);
    return NextResponse.json({ ok: true, job, durationMs: Date.now() - started, result });
  } catch (err) {
    log.error("job failed", { job, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, job, error: "job failed" }, { status: 500 });
  }
}
