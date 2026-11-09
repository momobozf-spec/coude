// Webhook voor inkomende mails (Postmark Inbound, JSON-formaat).
// Postmark roept deze URL aan met basic auth: https://USER:PASS@jouwdomein/api/inbound
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { intEnv, required } from "@/lib/env";
import { extractListings, htmlToText, isForwardingVerification } from "@/lib/inbound";
import { MATCH_THRESHOLD, scoreListing, sourceOf } from "@/lib/matching";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAiUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

type PostmarkInbound = {
  From?: string; Subject?: string; TextBody?: string; HtmlBody?: string;
  MailboxHash?: string; OriginalRecipient?: string; To?: string;
};

export async function POST(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return new NextResponse("unauthorized", { status: 401 });

  const mail = (await req.json().catch(() => null)) as PostmarkInbound | null;
  if (!mail) return NextResponse.json({ ok: false, reason: "bad_json" }); // 200: niet opnieuw proberen

  const token = tokenFrom(mail);
  if (!token) return NextResponse.json({ ok: false, reason: "no_token" });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("search_profiles").select("*").eq("inbound_token", token).maybeSingle();
  if (!profile) return NextResponse.json({ ok: false, reason: "unknown_token" });
  const userId: string = profile.user_id;

  const from = mail.From ?? "";
  const subject = mail.Subject ?? "";
  const text = mail.TextBody?.trim() ? `${mail.TextBody}\n${mail.HtmlBody ? htmlToText(mail.HtmlBody) : ""}` : htmlToText(mail.HtmlBody ?? "");

  // Bevestiging van doorsturen (Gmail): bewaar kort zodat de gebruiker de code ziet.
  if (isForwardingVerification(from, subject)) {
    await db.from("search_profiles").update({
      forward_verification: `${subject}\n\n${text}`.slice(0, 2000),
      forward_verification_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return NextResponse.json({ ok: true, kind: "verification" });
  }

  // Alleen Zoekpas-gebruikers.
  const { data: p } = await db.from("profiles").select("zoekpas_status, zoekpas_period_end").eq("id", userId).maybeSingle();
  const active = p && ["active", "trialing"].includes(p.zoekpas_status ?? "") &&
    (!p.zoekpas_period_end || new Date(p.zoekpas_period_end).getTime() > Date.now());
  if (!active) return NextResponse.json({ ok: false, reason: "no_zoekpas" });

  // Misbruikrem per dag.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("inbound_mails").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("received_at", since);
  if ((count ?? 0) >= intEnv("INBOUND_MAILS_PER_DAY", 30)) return NextResponse.json({ ok: false, reason: "day_limit" });

  let listings;
  try {
    const r = await extractListings(text);
    listings = r.listings;
    if (r.model) await logAiUsage(userId, "inbound_extract", r.model, r.usage);
  } catch (e) {
    console.error("Panden uitlezen mislukt", e);
    return NextResponse.json({ ok: false, reason: "ai_failed" }, { status: 500 }); // Postmark probeert opnieuw
  }

  const search = {
    maxMonthly: profile.max_monthly,
    municipalities: profile.municipalities ?? [],
    minBedrooms: profile.min_bedrooms ?? 0,
    pets: !!profile.pets,
  };
  const rows = listings.map((l) => {
    const { score, reasons } = scoreListing(l, search);
    return {
      user_id: userId,
      source: sourceOf(l.url) ?? "andere",
      url: l.url,
      title: l.title,
      municipality: l.municipality ?? l.postcode,
      rent_eur: l.rent_eur,
      charges_eur: l.charges_eur,
      bedrooms: l.bedrooms,
      pets_allowed: l.pets_allowed,
      score,
      reasons,
      status: score >= MATCH_THRESHOLD ? "new" : "dismissed",
    };
  });

  if (rows.length) {
    const { error } = await db.from("matches").upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true });
    if (error) {
      console.error("Matches opslaan mislukt", error);
      return NextResponse.json({ ok: false, reason: "db" }, { status: 500 });
    }
  }
  await db.from("inbound_mails").insert({ user_id: userId, listings_found: rows.length });
  await db.from("search_profiles").update({ last_mail_at: new Date().toISOString() }).eq("user_id", userId);

  return NextResponse.json({ ok: true, found: rows.length, matched: rows.filter((r) => r.status === "new").length });
}

function tokenFrom(mail: PostmarkInbound): string | null {
  const candidates = [mail.MailboxHash, mail.OriginalRecipient, mail.To].filter(Boolean) as string[];
  for (const c of candidates) {
    const m = /^[a-f0-9]{18}$/.exec(c.trim()) ?? /\+([a-f0-9]{18})@/i.exec(c);
    if (m) return (m[1] ?? m[0]).toLowerCase();
  }
  return null;
}

function authorized(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const expected = Buffer.from(`${required("INBOUND_WEBHOOK_USER")}:${required("INBOUND_WEBHOOK_PASSWORD")}`);
  const given = Buffer.from(Buffer.from(header.slice(6), "base64").toString("utf8"));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
