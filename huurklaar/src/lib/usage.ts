import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Legt AI-tokengebruik vast. Faalt nooit hard: een mislukte log mag de klant niet storen. */
export async function logAiUsage(
  userId: string | null, kind: "listing_check" | "inbound_extract", model: string,
  usage: { input_tokens?: number | null; output_tokens?: number | null } | undefined,
) {
  if (!usage) return;
  const { error } = await supabaseAdmin().from("ai_usage").insert({
    user_id: userId,
    kind,
    model,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
  });
  if (error) console.error("AI-gebruik loggen mislukt", error.message);
}
