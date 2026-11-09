import { NextResponse } from "next/server";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import { ROLES } from "@/lib/roles";
import { audit, requireApi } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

const Add = z.object({ email: z.string().trim().toLowerCase().email().max(320), role: z.enum(ROLES) });
const Remove = z.object({ userId: z.string().uuid() });

async function prep() {
  const staff = await requireApi("team.manage");
  if (staff instanceof NextResponse) return { res: staff };
  const limited = await limit(`team:${staff.userId}`, 60, 3600);
  if (limited) return { res: limited };
  return { staff };
}

export async function POST(req: Request) {
  const p = await prep();
  if ("res" in p) return p.res;
  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: user } = await db.from("profiles").select("id, email").ilike("email", parsed.data.email.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.id === p.staff.userId) return NextResponse.json({ error: "self" }, { status: 400 });

  const { data: before } = await db.from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
  const { error } = await db.from("staff_roles").upsert({ user_id: user.id, role: parsed.data.role, granted_by: p.staff.userId }, { onConflict: "user_id" });
  if (error) {
    const lastOwner = /eigenaar/i.test(error.message);
    return NextResponse.json({ error: lastOwner ? "last_owner" : "server" }, { status: lastOwner ? 400 : 500 });
  }
  await audit(p.staff, "team.set_role", { id: user.id, email: user.email }, { from: before?.role ?? null, to: parsed.data.role });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const p = await prep();
  if ("res" in p) return p.res;
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (parsed.data.userId === p.staff.userId) return NextResponse.json({ error: "self" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: before } = await db.from("staff_roles").select("role").eq("user_id", parsed.data.userId).maybeSingle();
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { error } = await db.from("staff_roles").delete().eq("user_id", parsed.data.userId);
  if (error) {
    const lastOwner = /eigenaar/i.test(error.message);
    return NextResponse.json({ error: lastOwner ? "last_owner" : "server" }, { status: lastOwner ? 400 : 500 });
  }
  const { data: u } = await db.from("profiles").select("email").eq("id", parsed.data.userId).maybeSingle();
  await audit(p.staff, "team.remove", { id: parsed.data.userId, email: u?.email ?? null }, { role: before.role });
  return NextResponse.json({ ok: true });
}
