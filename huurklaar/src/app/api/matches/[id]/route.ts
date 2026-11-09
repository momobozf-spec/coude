import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({ status: z.enum(["seen", "dismissed", "applied", "new"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getAccount();
  if (!a) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!a.zoekpasActive) return NextResponse.json({ error: "zoekpas" }, { status: 402 });
  const limited = await limit(`matches:${a.userId}`, 600, 3600);
  if (limited) return limited;
  const { id } = await params;
  const matchId = Number(id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(matchId) || !parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: m } = await db.from("matches").select("id, title, url").eq("id", matchId).eq("user_id", a.userId).maybeSingle();
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.from("matches").update({ status: parsed.data.status }).eq("id", matchId).eq("user_id", a.userId);

  // "Gesolliciteerd" maakt meteen een kandidatuur aan in de opvolging.
  if (parsed.data.status === "applied") {
    const { data: exists } = await db.from("applications").select("id").eq("user_id", a.userId).eq("match_id", matchId).maybeSingle();
    if (!exists) {
      const followUp = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      await db.from("applications").insert({ user_id: a.userId, title: m.title, url: m.url, status: "sent", match_id: matchId, next_action_on: followUp });
    }
  }
  return NextResponse.json({ ok: true });
}
