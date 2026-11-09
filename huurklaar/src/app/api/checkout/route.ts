import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/env";
import { priceFor, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({ product: z.enum(["dossier", "zoekpas"]), lang: z.enum(["nl", "fr"]) });

const WAIVER = {
  nl: "Ik vraag dat de digitale dienst meteen start en weet dat ik daardoor mijn herroepingsrecht van 14 dagen verlies.",
  fr: "Je demande que le service numérique commence immédiatement et je sais que je perds ainsi mon droit de rétractation de 14 jours.",
};

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { product, lang } = parsed.data;

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "login" }, { status: 401 });
  const limited = await limit(`checkout:${account.userId}`, 10, 3600);
  if (limited) return limited;
  if (product === "dossier" && (account.dossierPaid || account.zoekpasActive))
    return NextResponse.json({ error: "already_owned" }, { status: 409 });
  if (product === "zoekpas" && account.zoekpasActive)
    return NextResponse.json({ error: "already_owned" }, { status: 409 });

  const s = stripe();
  let customer = account.stripeCustomerId;
  if (!customer) {
    const c = await s.customers.create(
      { email: account.email ?? undefined, metadata: { user_id: account.userId }, preferred_locales: [lang] },
      { idempotencyKey: `customer-${account.userId}` },
    );
    customer = c.id;
    await supabaseAdmin().from("profiles").update({ stripe_customer_id: customer }).eq("id", account.userId);
  }

  const base = siteUrl();
  const session = await s.checkout.sessions.create({
    mode: product === "dossier" ? "payment" : "subscription",
    customer,
    client_reference_id: account.userId,
    line_items: [{ price: priceFor(product), quantity: 1 }],
    metadata: { user_id: account.userId, product },
    ...(product === "zoekpas"
      ? { subscription_data: { metadata: { user_id: account.userId } } }
      : { invoice_creation: { enabled: true }, payment_intent_data: { metadata: { user_id: account.userId, product } } }),
    locale: lang,
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: "required" },
    custom_text: { terms_of_service_acceptance: { message: WAIVER[lang] } },
    success_url: `${base}/${lang}/account?paid=1`,
    cancel_url: `${base}/${lang}/prijzen`,
  });

  return NextResponse.json({ url: session.url });
}
