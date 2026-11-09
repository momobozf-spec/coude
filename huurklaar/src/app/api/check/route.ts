import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { intEnv } from "@/lib/env";
import { analyzeListing } from "@/lib/listing";
import { clientIp, limit } from "@/lib/ratelimit";
import { budgetCheck, monthlyTotal } from "@/lib/rules";
import { logAiUsage } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().trim().min(80).max(12000),
  lang: z.enum(["nl", "fr"]),
  netIncome: z.number().nonnegative().max(1_000_000).optional(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const short = typeof raw?.text === "string" && raw.text.trim().length < 80;
    return NextResponse.json({ error: short ? "too_short" : "bad_request" }, { status: 400 });
  }
  const { text, lang, netIncome } = parsed.data;

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "login" }, { status: 401 });
  const limited = (await limit(`check-ip:${clientIp(req)}`, 60, 3600)) ?? (await limit(`check-user:${account.userId}`, 20, 600));
  if (limited) return limited;

  const db = supabaseAdmin();
  const { data: claim, error: claimErr } = await db
    .rpc("claim_listing_check", {
      p_user: account.userId,
      p_free: intEnv("FREE_CHECKS", 3),
      p_daily: intEnv("ZOEKPAS_CHECKS_PER_DAY", 40),
      p_unlimited: account.zoekpasActive,
    })
    .single<{ allowed: boolean; reason: string; used_total: number }>();
  if (claimErr || !claim) return NextResponse.json({ error: "server" }, { status: 500 });
  if (!claim.allowed) return NextResponse.json({ error: claim.reason }, { status: 402 });

  try {
    const { analysis, model, usage } = await analyzeListing(text, lang);
    await logAiUsage(account.userId, "listing_check", model, usage);
    const total = analysis.rent_eur != null ? monthlyTotal(analysis.rent_eur, analysis.charges_eur ?? 0) : null;
    const budget = total && netIncome ? budgetCheck(total, netIncome) : null;
    const free = intEnv("FREE_CHECKS", 3) + account.bonusChecks;
    return NextResponse.json({
      analysis,
      total,
      budget,
      checksLeft: account.zoekpasActive ? null : Math.max(0, free - claim.used_total),
    });
  } catch (e) {
    console.error("Advertentie-check mislukt", e);
    await db.rpc("refund_listing_check", { p_user: account.userId });
    return NextResponse.json({ error: "ai_failed" }, { status: 502 });
  }
}
