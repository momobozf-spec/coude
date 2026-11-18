import type { AiPayload } from "./ai-payload";
import type { AiResult } from "./ai-types";
import { config } from "./config";

export type AiError = "not_paid" | "limit_reached" | "ai_failed" | "network";

/** Sends the pseudonymised selection (no real names, numbers, links or e-mails) for the AI slides. */
export async function fetchAi(payload: AiPayload, appUserId: string, transactionId: string): Promise<{ ok: true; result: AiResult } | { ok: false; error: AiError }> {
  try {
    const res = await fetch(`${config.apiUrl}/api/app/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appUserId, transactionId, payload }),
    });
    if (res.ok) return { ok: true, result: (await res.json()) as AiResult };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "not_paid" || body.error === "limit_reached") return { ok: false, error: body.error };
    return { ok: false, error: "ai_failed" };
  } catch {
    return { ok: false, error: "network" };
  }
}
