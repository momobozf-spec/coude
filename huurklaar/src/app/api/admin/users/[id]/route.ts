import { NextResponse } from "next/server";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import type { Permission } from "@/lib/roles";
import { audit, requireApi, type Staff } from "@/lib/staff";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bonus"), amount: z.number().int().min(1).max(50) }),
  z.object({ action: z.literal("comp_dossier") }),
  z.object({ action: z.literal("revoke_dossier") }),
  z.object({ action: z.literal("block") }),
  z.object({ action: z.literal("unblock") }),
]);

const NEEDS: Record<z.infer<typeof Body>["action"], Permission> = {
  bonus: "users.support", comp_dossier: "users.support", revoke_dossier: "users.support",
  block: "users.block", unblock: "users.block",
};

async function target(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from("profiles").select("id, email, bonus_checks, zoekpas_subscription_id, zoekpas_status").eq("id", id).maybeSingle();
  return data;
}

async function guard(staff: Staff) {
  return limit(`admin:${staff.userId}`, 120, 3600);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const body = parsed.data;

  const staff = await requireApi(NEEDS[body.action]);
  if (staff instanceof NextResponse) return staff;
  const limited = await guard(staff);
  if (limited) return limited;

  const { id } = await params;
  const u = await target(id);
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((body.action === "block" || body.action === "unblock") && id === staff.userId)
    return NextResponse.json({ error: "self" }, { status: 400 });

  const db = supabaseAdmin();
  let error: { message: string } | null = null;
  switch (body.action) {
    case "bonus":
      ({ error } = await db.from("profiles").update({ bonus_checks: Math.min(1000, (u.bonus_checks ?? 0) + body.amount) }).eq("id", id));
      break;
    case "comp_dossier":
      ({ error } = await db.from("profiles").update({ dossier_comp: true }).eq("id", id));
      break;
    case "revoke_dossier":
      ({ error } = await db.from("profiles").update({ dossier_comp: false }).eq("id", id));
      break;
    case "block":
      ({ error } = await db.auth.admin.updateUserById(id, { ban_duration: "876000h" }));
      break;
    case "unblock":
      ({ error } = await db.auth.admin.updateUserById(id, { ban_duration: "none" }));
      break;
  }
  if (error) {
    console.error("Beheeractie mislukt", body.action, error.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  await audit(staff, `user.${body.action}`, { id, email: u.email }, body.action === "bonus" ? { amount: body.amount } : {});
  return NextResponse.json({ ok: true });
}

const DeleteBody = z.object({ confirm: z.string() });

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireApi("users.delete");
  if (staff instanceof NextResponse) return staff;
  const limited = await guard(staff);
  if (limited) return limited;

  const { id } = await params;
  if (id === staff.userId) return NextResponse.json({ error: "self" }, { status: 400 });
  const u = await target(id);
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.confirm !== (u.email ?? id)) return NextResponse.json({ error: "confirm" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: role } = await db.from("staff_roles").select("role").eq("user_id", id).maybeSingle();
  if (role?.role === "owner") return NextResponse.json({ error: "last_owner" }, { status: 400 });

  // Lopend abonnement eerst stoppen, anders blijft Stripe aanrekenen.
  if (u.zoekpas_subscription_id && ["active", "trialing", "past_due"].includes(u.zoekpas_status ?? "")) {
    try {
      await stripe().subscriptions.cancel(u.zoekpas_subscription_id);
    } catch (e) {
      console.error("Abonnement opzeggen mislukt", e);
      return NextResponse.json({ error: "stripe" }, { status: 502 });
    }
  }

  const { error } = await db.auth.admin.deleteUser(id);
  if (error) {
    console.error("Account wissen mislukt", error.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  await audit(staff, "user.delete", { id, email: u.email });
  return NextResponse.json({ ok: true });
}
