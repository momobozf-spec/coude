// Stripe-webhook: bewaart betaalde bestellingen en mailt de downloadlink in de taal van het spel (via Resend, indien ingesteld).
import { createClient } from "npm:@supabase/supabase-js@2";
import { downloadEmail, getProduct, verifyStripeSignature } from "../_shared/lib.ts";
import { env, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Alleen POST" }, 405);

  const payload = await req.text();
  const ok = await verifyStripeSignature(
    payload,
    req.headers.get("stripe-signature"),
    env("STRIPE_WEBHOOK_SECRET"),
    Math.floor(Date.now() / 1000),
  );
  if (!ok) return json({ error: "Ongeldige handtekening" }, 400);

  const event = JSON.parse(payload);
  const relevant = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!relevant.includes(event.type)) return json({ received: true }, 200);

  const s = event.data.object;
  const productId: string | undefined = s.metadata?.product;
  const product = getProduct(productId);
  if (!product || s.payment_status !== "paid") return json({ received: true }, 200);

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const email: string | null = s.customer_details?.email ?? null;

  // Idempotent: dezelfde sessie wordt maar één keer bewaard en gemaild.
  const { data: inserted, error } = await supabase
    .from("tafelmoord_orders")
    .upsert(
      {
        stripe_session_id: s.id,
        product: productId,
        email,
        amount_total_cents: s.amount_total,
        currency: s.currency,
        livemode: s.livemode,
        withdrawal_waiver_at: s.metadata?.withdrawal_waiver_at ?? null,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("orders upsert", error);
    return json({ error: "db" }, 500); // Stripe probeert opnieuw
  }

  const isNew = (inserted?.length ?? 0) > 0;
  const resendKey = env("RESEND_API_KEY", false);
  const mailFrom = env("MAIL_FROM", false);
  if (isNew && email && resendKey && mailFrom) {
    const mail = downloadEmail(env("SITE_URL"), s.id, product);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: [email], subject: mail.subject, html: mail.html }),
    });
    if (res.ok) {
      await supabase.from("tafelmoord_orders").update({ email_sent_at: new Date().toISOString() }).eq("stripe_session_id", s.id);
    } else {
      console.error("resend", res.status, await res.text());
    }
  }
  return json({ received: true }, 200);
});
