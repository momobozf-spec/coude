import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { required } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, required("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: seen } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        if (!userId) break;
        if (session.mode === "payment" && session.payment_status === "paid") {
          await db.from("profiles").update({ dossier_paid_at: new Date().toISOString() }).eq("id", userId);
        }
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const sub = await stripe().subscriptions.retrieve(session.subscription);
          await syncSubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object);
        break;
      }
      case "charge.succeeded":
      case "charge.updated":
      case "charge.refunded": {
        await recordCharge(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook verwerking mislukt", event.type, e);
    // 500 zodat Stripe het event later opnieuw stuurt.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  await db.from("stripe_events").insert({ id: event.id, type: event.type });
  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription, knownUserId?: string) {
  const db = supabaseAdmin();
  let userId = knownUserId ?? sub.metadata?.user_id;
  if (!userId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const { data } = await db.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.id;
  }
  if (!userId) return;

  const periodEnd = sub.items.data.reduce((max, item) => Math.max(max, item.current_period_end ?? 0), 0);
  await db
    .from("profiles")
    .update({
      zoekpas_status: sub.status,
      zoekpas_subscription_id: sub.id,
      zoekpas_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      zoekpas_cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("id", userId);
}

/** Legt een betaling vast voor het beheerplatform: bedrag, terugbetaling en Stripe-kosten. */
async function recordCharge(charge: Stripe.Charge) {
  if (charge.status !== "succeeded" && !charge.refunded) return;
  const db = supabaseAdmin();
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;

  let userId: string | null = charge.metadata?.user_id ?? null;
  if (!userId && customerId) {
    const { data } = await db.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.id ?? null;
  }

  // Product: de eenmalige aankoop draagt metadata.product; abonnementscharges komen via een factuur.
  let meta = charge.metadata?.product;
  let piDescription: string | null = null;
  if (meta !== "dossier" && meta !== "zoekpas" && typeof charge.payment_intent === "string") {
    try {
      const pi = await stripe().paymentIntents.retrieve(charge.payment_intent);
      meta = pi.metadata?.product;
      piDescription = pi.description;
      if (!userId && pi.metadata?.user_id) userId = pi.metadata.user_id;
    } catch (e) {
      console.error("PaymentIntent ophalen mislukt", e);
    }
  }
  const product =
    meta === "dossier" || meta === "zoekpas" ? meta
    : chargeIsFromInvoice(charge) || /subscription/i.test(piDescription ?? "") ? "zoekpas"
    : "onbekend";

  let fee: number | null = null;
  const bt = charge.balance_transaction;
  if (bt) {
    try {
      const tx = typeof bt === "string" ? await stripe().balanceTransactions.retrieve(bt) : bt;
      fee = tx.fee;
    } catch (e) {
      console.error("Stripe-kosten ophalen mislukt", e);
    }
  }

  const { error } = await db.from("payments").upsert({
    charge_id: charge.id,
    user_id: userId,
    customer_id: customerId,
    product,
    amount_cents: charge.amount,
    refunded_cents: charge.amount_refunded,
    ...(fee != null ? { fee_cents: fee } : {}),
    currency: charge.currency,
    status: charge.refunded ? "refunded" : charge.amount_refunded > 0 ? "partially_refunded" : charge.status,
    created_at: new Date(charge.created * 1000).toISOString(),
  }, { onConflict: "charge_id" });
  if (error) throw new Error(`Betaling opslaan mislukt: ${error.message}`);
}

function chargeIsFromInvoice(charge: Stripe.Charge): boolean {
  const c = charge as unknown as { invoice?: unknown; description?: string | null };
  return !!c.invoice || /subscription|abonnement/i.test(c.description ?? "");
}
