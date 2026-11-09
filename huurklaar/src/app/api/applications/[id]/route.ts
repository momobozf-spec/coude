import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { ApplicationPatch } from "@/lib/applications";
import { supabaseServer } from "@/lib/supabase/server";

async function guard(params: Promise<{ id: string }>) {
  const a = await getAccount();
  if (!a) return { res: NextResponse.json({ error: "login" }, { status: 401 }) };
  if (!a.zoekpasActive) return { res: NextResponse.json({ error: "zoekpas" }, { status: 402 }) };
  const limited = await limit(`apps:${a.userId}`, 300, 3600);
  if (limited) return { res: limited };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { res: NextResponse.json({ error: "bad_request" }, { status: 400 }) };
  return { id };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("res" in g) return g.res;
  const parsed = ApplicationPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const db = await supabaseServer(); // RLS: alleen eigen rijen
  const { data, error } = await db.from("applications").update(parsed.data).eq("id", g.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("res" in g) return g.res;
  const db = await supabaseServer();
  const { error } = await db.from("applications").delete().eq("id", g.id);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
