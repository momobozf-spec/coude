import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { submissionLog } from "@/db/schema";
import { hashIp } from "./tokens";

const LIMITS: Record<string, { perHour: number }> = { request: { perHour: 5 }, message: { perHour: 60 }, report: { perHour: 5 }, register: { perHour: 5 } };

/** Geeft true als de inzending mag; registreert ze meteen. */
export async function allowSubmission(ip: string, kind: keyof typeof LIMITS): Promise<boolean> {
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissionLog)
    .where(and(eq(submissionLog.ipHash, ipHash), eq(submissionLog.kind, kind), gt(submissionLog.createdAt, since)));
  if (n >= LIMITS[kind].perHour) return false;
  await db.insert(submissionLog).values({ ipHash, kind });
  return true;
}
