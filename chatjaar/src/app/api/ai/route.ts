import { NextResponse } from "next/server";
import { MAX_AI_RUNS, getPaidSession, getStripe } from "@/lib/server-config";
import { generateAi, validatePayload } from "@/lib/ai-generate";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { sessionId?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const payload = validatePayload(body.payload);
  if (!payload) return NextResponse.json({ error: "bad_payload" }, { status: 400 });

  const session = await getPaidSession(body.sessionId ?? "");
  if (!session) return NextResponse.json({ error: "not_paid" }, { status: 402 });

  // Cap the number of AI runs per payment, tracked on the PaymentIntent.
  const stripe = getStripe();
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!piId) return NextResponse.json({ error: "not_paid" }, { status: 402 });
  const pi = await stripe.paymentIntents.retrieve(piId);
  const runs = Number(pi.metadata?.ai_runs ?? "0") || 0;
  if (runs >= MAX_AI_RUNS) return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  await stripe.paymentIntents.update(piId, { metadata: { ai_runs: String(runs + 1) } });

  try {
    const result = await generateAi(payload);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("ai_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
