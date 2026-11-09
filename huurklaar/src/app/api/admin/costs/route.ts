import { NextResponse } from "next/server";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import { audit, requireApi } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["hosting", "software", "marketing", "diensten", "andere"]),
  monthly_eur: z.number().min(0).max(100_000),
  starts_on: isoDate,
});

export async function POST(req: Request) {
  const staff = await requireApi("costs.edit");
  if (staff instanceof NextResponse) return staff;
  const limited = await limit(`admin:${staff.userId}`, 120, 3600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data, error } = await supabaseAdmin().from("fixed_costs")
    .insert({ ...parsed.data, monthly_eur: Math.round(parsed.data.monthly_eur * 100) / 100, created_by: staff.userId })
    .select("id").single();
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });
  await audit(staff, "cost.create", undefined, { id: data.id, ...parsed.data });
  return NextResponse.json({ ok: true });
}
