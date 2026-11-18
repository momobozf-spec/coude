// POST { product: "oudejaar-nl", waiver: true } -> { url } : maakt een Stripe Checkout-sessie aan.
import { buildCheckoutParams, InputError, parsePriceIds } from "../_shared/lib.ts";
import { corsHeaders, env, json, stripe } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Alleen POST" }, 405, cors);

  try {
    const body = await req.json().catch(() => ({}));
    const params = buildCheckoutParams(
      {
        siteUrl: env("SITE_URL"),
        priceIds: parsePriceIds(env("STRIPE_PRICES", false) || undefined),
        taxRateId: env("STRIPE_TAX_RATE_ID", false) || undefined,
      },
      { product: body?.product, waiver: body?.waiver, nowIso: new Date().toISOString() },
    );
    const session = await stripe("checkout/sessions", { method: "POST", body: params });
    return json({ url: session.url }, 200, cors);
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, 400, cors);
    console.error("create-checkout", e);
    return json({ error: "Afrekenen lukt nu niet / Le paiement ne fonctionne pas pour le moment." }, 500, cors);
  }
});
