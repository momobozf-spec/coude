import { NextResponse } from "next/server";
import { limit } from "@/lib/ratelimit";
import { audit, requireApi } from "@/lib/staff";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireApi("payments.refund");
  if (staff instanceof NextResponse) return staff;
  const limited = await limit(`refund:${staff.userId}`, 20, 3600);
  if (limited) return limited;

  const { id } = await params;
  if (!/^ch_[A-Za-z0-9]+$|^py_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: pay } = await db.from("payments").select("*").eq("charge_id", id).maybeSingle();
  if (!pay) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const remaining = pay.amount_cents - pay.refunded_cents;
  if (remaining <= 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    await stripe().refunds.create({ charge: id, amount: remaining, reason: "requested_by_customer" }, { idempotencyKey: `refund-${id}-${remaining}` });
  } catch (e) {
    console.error("Terugbetaling mislukt", e);
    return NextResponse.json({ error: "stripe" }, { status: 502 });
  }

  // Toegang intrekken die bij deze betaling hoort.
  if (pay.user_id) {
    if (pay.product === "dossier") {
      await db.from("profiles").update({ dossier_paid_at: null }).eq("id", pay.user_id);
    } else if (pay.product === "zoekpas") {
      const { data: p } = await db.from("profiles").select("zoekpas_subscription_id, zoekpas_status").eq("id", pay.user_id).maybeSingle();
      if (p?.zoekpas_subscription_id && ["active", "trialing", "past_due"].includes(p.zoekpas_status ?? "")) {
        try { await stripe().subscriptions.cancel(p.zoekpas_subscription_id); } catch (e) { console.error("Opzeggen na terugbetaling mislukt", e); }
      }
    }
  }

  const { data: target } = pay.user_id ? await db.from("profiles").select("email").eq("id", pay.user_id).maybeSingle() : { data: null };
  await audit(staff, "payment.refund", { id: pay.user_id, email: target?.email ?? null }, { charge: id, amount_cents: remaining, product: pay.product });
  return NextResponse.json({ ok: true });
}
