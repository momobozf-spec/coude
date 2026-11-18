import { NextResponse } from "next/server";
import { MAX_AI_RUNS } from "@/lib/server-config";
import { generateAi, validatePayload } from "@/lib/ai-generate";
import { isValidAppUserId, isValidTransactionId, setRuns, verifyUnlock } from "@/lib/revenuecat";

export const maxDuration = 60;

/** AI slides for the mobile app: paid with an in-app purchase, verified at RevenueCat. */
export async function POST(req: Request) {
  let body: { appUserId?: unknown; transactionId?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const payload = validatePayload(body.payload);
  if (!payload) return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  if (!isValidAppUserId(body.appUserId) || !isValidTransactionId(body.transactionId)) {
    return NextResponse.json({ error: "not_paid" }, { status: 402 });
  }

  let unlock;
  try {
    unlock = await verifyUnlock(body.appUserId, body.transactionId);
  } catch (err) {
    console.error("revenuecat_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
  if (!unlock) return NextResponse.json({ error: "not_paid" }, { status: 402 });
  if (unlock.runs >= MAX_AI_RUNS) return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  await setRuns(body.appUserId, unlock.runsKey, unlock.runs + 1).catch((err) =>
    console.error("revenuecat_attr_failed", err instanceof Error ? err.message : err),
  );

  try {
    const result = await generateAi(payload);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("ai_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
