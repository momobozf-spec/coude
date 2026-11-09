import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { MATCH_THRESHOLD, parsePlaces, scoreListing } from "@/lib/matching";
import { getOrCreateSearchProfile } from "@/lib/search";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  maxMonthly: z.number().int().min(0).max(20_000).nullable(),
  municipalities: z.string().max(1000),
  minBedrooms: z.number().int().min(0).max(10),
  pets: z.boolean(),
});

export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return NextResponse.json({ error: "login" }, { status: 401 });
  const limited = await limit(`profile:${a.userId}`, 30, 3600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await getOrCreateSearchProfile(a.userId);
  const p = parsed.data;
  const municipalities = parsePlaces(p.municipalities);
  const db = supabaseAdmin();
  const { error } = await db.from("search_profiles").update({
    max_monthly: p.maxMonthly || null,
    municipalities,
    min_bedrooms: p.minBedrooms,
    pets: p.pets,
  }).eq("user_id", a.userId);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });

  // Bestaande matches herberekenen met het nieuwe profiel (niet die waarop al gereageerd werd).
  const { data: existing } = await db.from("matches")
    .select("id, title, url, municipality, rent_eur, charges_eur, bedrooms, pets_allowed, status")
    .eq("user_id", a.userId).neq("status", "applied").limit(500);
  const profile = { maxMonthly: p.maxMonthly || null, municipalities, minBedrooms: p.minBedrooms, pets: p.pets };
  for (const m of existing ?? []) {
    const { score, reasons } = scoreListing({ ...m, postcode: null }, profile);
    const status = score >= MATCH_THRESHOLD ? (m.status === "dismissed" ? "new" : m.status) : "dismissed";
    await db.from("matches").update({ score, reasons, status }).eq("id", m.id).eq("user_id", a.userId);
  }
  return NextResponse.json({ ok: true, municipalities });
}
