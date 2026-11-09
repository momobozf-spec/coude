import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Beperkt het aantal verzoeken per sleutel en tijdvenster.
 * Faalt dicht: als de limiter zelf niet werkt, wordt het verzoek geweigerd.
 */
export async function limit(key: string, max: number, windowSeconds: number): Promise<NextResponse | null> {
  const { data, error } = await supabaseAdmin().rpc("rate_limit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  if (error) {
    console.error("Rate limiter faalt", error.message);
    return NextResponse.json({ error: "server" }, { status: 503 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(windowSeconds) } });
  }
  return null;
}

export function clientIp(req: Request): string {
  // Op Vercel zet het platform x-forwarded-for; het eerste adres is de client.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
