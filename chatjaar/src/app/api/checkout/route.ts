import { NextResponse } from "next/server";
import { CURRENCY, PRICE_CENTS, PRODUCT_TAG, getStripe, siteUrl } from "@/lib/server-config";
import { FALLBACK_LOCALE, isLocale, type Locale } from "@/i18n/dictionaries";
import { BRAND } from "@/lib/brand";


const PRODUCT_NAME: Record<Locale, string> = {
  nl: `${BRAND} — volledig jaaroverzicht van je groepschat`,
  fr: `${BRAND} — bilan complet de ta discussion de groupe`,
  en: `${BRAND} — full year in review of your group chat`,
  de: `${BRAND} — kompletter Jahresrückblick deines Gruppenchats`,
  es: `${BRAND} — resumen completo del año de tu chat de grupo`,
};

export async function POST(req: Request) {
  let body: { locale?: string; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const locale = body.locale && isLocale(body.locale) ? body.locale : FALLBACK_LOCALE;
  // Digital content delivered immediately: the buyer must waive the withdrawal right first.
  if (body.consent !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });

  const base = siteUrl();
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      locale,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: PRICE_CENTS,
            product_data: { name: PRODUCT_NAME[locale] },
            ...(process.env.STRIPE_AUTOMATIC_TAX === "true" ? { tax_behavior: "inclusive" as const } : {}),
          },
        },
      ],
      allow_promotion_codes: true,
      ...(process.env.STRIPE_AUTOMATIC_TAX === "true" ? { automatic_tax: { enabled: true } } : {}),
      metadata: { product: PRODUCT_TAG, locale, withdrawal_waived: "true" },
      payment_intent_data: { metadata: { product: PRODUCT_TAG, ai_runs: "0" } },
      success_url: `${base}/${locale}/result?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${locale}/start?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
