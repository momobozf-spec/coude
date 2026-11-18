// Preload voor de rooktest: vervangt fetch naar Stripe, Supabase en Resend door nepantwoorden.
// Alle uitgaande verzoeken worden gelogd naar FAKE_LOG (één JSON-regel per verzoek).
const realFetch = globalThis.fetch;
const log = Deno.env.get("FAKE_LOG")!;
const now = Math.floor(Date.now() / 1000);

const sessions: Record<string, unknown> = {
  cs_test_paidSESSION0001: { id: "cs_test_paidSESSION0001", payment_status: "paid", created: now - 60, metadata: { product: "oudejaar-nl" } },
  cs_test_paidKIDSFR00001: { id: "cs_test_paidKIDSFR00001", payment_status: "paid", created: now - 60, metadata: { product: "taart-fr" } },
  cs_test_unpaidSESSION01: { id: "cs_test_unpaidSESSION01", payment_status: "unpaid", created: now - 60, metadata: { product: "oudejaar-nl" } },
  cs_test_oldSESSION00001: { id: "cs_test_oldSESSION00001", payment_status: "paid", created: now - 400 * 86400, metadata: { product: "oudejaar-nl" } },
  cs_test_otherSHOP00001: { id: "cs_test_otherSHOP00001", payment_status: "paid", created: now - 60, metadata: { product: "iets-anders" } },
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const body = req.method === "GET" ? "" : await req.clone().text();
  await Deno.writeTextFile(log, JSON.stringify({ method: req.method, host: url.host, path: url.pathname, body }) + "\n", { append: true });

  if (url.host === "api.stripe.com") {
    if (url.pathname === "/v1/checkout/sessions" && req.method === "POST") {
      return reply({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" });
    }
    const m = url.pathname.match(/^\/v1\/checkout\/sessions\/(.+)$/);
    if (m) return sessions[m[1]] ? reply(sessions[m[1]]) : reply({ error: { message: "No such session" } }, 404);
  }
  if (url.host === "fake.supabase.co") {
    if (url.pathname.startsWith("/storage/v1/object/sign/")) {
      const file = url.pathname.split("/").pop();
      return reply({ signedURL: `/storage/v1/object/sign/tafelmoord-pakketten/${file}?token=abc` });
    }
    if (url.pathname === "/rest/v1/tafelmoord_orders") {
      // upsert met ignoreDuplicates: eerste keer een rij, daarna leeg
      const seenFile = log + ".seen";
      let seen = "";
      try { seen = await Deno.readTextFile(seenFile); } catch { /* eerste keer */ }
      if (req.method === "POST") {
        const id = JSON.parse(body).stripe_session_id ?? JSON.parse(body)[0]?.stripe_session_id;
        if (seen.includes(id)) return reply([], 201);
        await Deno.writeTextFile(seenFile, id + "\n", { append: true });
        return reply([{ id: 1 }], 201);
      }
      return reply([], 200);
    }
  }
  if (url.host === "api.resend.com") return reply({ id: "email_1" });
  return realFetch(input, init);
};
