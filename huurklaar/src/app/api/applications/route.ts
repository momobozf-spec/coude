import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { ApplicationInput } from "@/lib/applications";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const a = await getAccount();
  if (!a) return NextResponse.json({ error: "login" }, { status: 401 });
  const db = await supabaseServer();
  const { data, error } = await db.from("applications").select("*").order("updated_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!a.zoekpasActive) return NextResponse.json({ error: "zoekpas" }, { status: 402 });
  const limited = await limit(`apps:${a.userId}`, 300, 3600);
  if (limited) return limited;
  const parsed = ApplicationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const db = await supabaseServer();
  const { data, error } = await db.from("applications").insert({ ...parsed.data, user_id: a.userId }).select("*").single();
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  return NextResponse.json({ item: data });
}
