import { NextResponse } from "next/server";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import { audit, requireApi } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

const Patch = z.object({ ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

async function prep(params: Promise<{ id: string }>) {
  const staff = await requireApi("costs.edit");
  if (staff instanceof NextResponse) return { res: staff };
  const limited = await limit(`admin:${staff.userId}`, 120, 3600);
  if (limited) return { res: limited };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { res: NextResponse.json({ error: "bad_request" }, { status: 400 }) };
  const { data: row } = await supabaseAdmin().from("fixed_costs").select("*").eq("id", id).maybeSingle();
  if (!row) return { res: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { staff, id, row };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await prep(params);
  if ("res" in p) return p.res;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.ends_on < p.row.starts_on) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await supabaseAdmin().from("fixed_costs").update({ ends_on: parsed.data.ends_on }).eq("id", p.id);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  await audit(p.staff, "cost.end", undefined, { id: p.id, name: p.row.name, ends_on: parsed.data.ends_on });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await prep(params);
  if ("res" in p) return p.res;
  const { error } = await supabaseAdmin().from("fixed_costs").delete().eq("id", p.id);
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  await audit(p.staff, "cost.delete", undefined, { id: p.id, name: p.row.name, monthly_eur: p.row.monthly_eur });
  return NextResponse.json({ ok: true });
}
