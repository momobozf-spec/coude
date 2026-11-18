// Draai: node --experimental-strip-types --test supabase/functions/_shared/lib.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutParams,
  CATALOG,
  downloadDecision,
  downloadEmail,
  getProduct,
  hmacSha256Hex,
  InputError,
  isValidSessionId,
  parsePriceIds,
  stripeEncode,
  verifyStripeSignature,
} from "./lib.ts";

const cfg = { siteUrl: "https://tafelmoord.be", priceIds: { "oudejaar-nl": "price_nl" }, taxRateId: "txr_456" };
const NOW = "2026-11-09T15:00:00.000Z";
const req = (product: unknown, waiver: unknown = true) => ({ product, waiver, nowIso: NOW });

test("catalogus bevat alle spellen in beide talen, met bestanden en prijzen", () => {
  for (const id of ["oudejaar-nl", "oudejaar-fr", "taart-nl", "taart-fr"]) {
    const p = CATALOG[id];
    assert.ok(p, id);
    assert.equal(p.file, `${id}.zip`);
    assert.ok(p.price_cents > 0);
  }
  assert.equal(CATALOG["taart-nl"].category, "kinderen");
  assert.equal(CATALOG["oudejaar-fr"].lang, "fr");
});

test("checkout weigert zonder afstand van herroepingsrecht", () => {
  assert.throws(() => buildCheckoutParams(cfg, req("oudejaar-nl", false)), InputError);
  assert.throws(() => buildCheckoutParams(cfg, req("oudejaar-nl", "true")), InputError);
});

test("checkout weigert onbekende of vreemde producten", () => {
  assert.throws(() => buildCheckoutParams(cfg, req("bestaat-niet")), InputError);
  assert.throws(() => buildCheckoutParams(cfg, req("__proto__")), InputError);
  assert.throws(() => buildCheckoutParams(cfg, req(undefined)), InputError);
  assert.equal(getProduct("toString"), null);
});

test("NL-checkout: Price ID, btw, factuur, consent, metadata, NL-urls", () => {
  const p = new URLSearchParams(buildCheckoutParams(cfg, req("oudejaar-nl")));
  assert.equal(p.get("locale"), "nl");
  assert.equal(p.get("line_items[0][price]"), "price_nl");
  assert.equal(p.get("line_items[0][tax_rates][0]"), "txr_456");
  assert.equal(p.get("invoice_creation[enabled]"), "true");
  assert.equal(p.get("consent_collection[terms_of_service]"), "required");
  assert.match(p.get("custom_text[terms_of_service_acceptance][message]")!, /herroepingsrecht verlies/);
  assert.match(p.get("custom_text[terms_of_service_acceptance][message]")!, /https:\/\/tafelmoord\.be\/nl\/voorwaarden\.html/);
  assert.equal(p.get("metadata[product]"), "oudejaar-nl");
  assert.equal(p.get("metadata[withdrawal_waiver_at]"), NOW);
  assert.equal(p.get("success_url"), "https://tafelmoord.be/nl/bedankt.html?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(p.get("cancel_url"), "https://tafelmoord.be/nl/oudejaar.html");
});

test("FR-kinderspel zonder Price ID: Franse checkout met prijs uit de catalogus", () => {
  const p = new URLSearchParams(buildCheckoutParams(cfg, req("taart-fr")));
  assert.equal(p.get("locale"), "fr");
  assert.equal(p.get("line_items[0][price]"), null);
  assert.equal(p.get("line_items[0][price_data][unit_amount]"), String(CATALOG["taart-fr"].price_cents));
  assert.equal(p.get("line_items[0][price_data][currency]"), "eur");
  assert.match(p.get("custom_text[terms_of_service_acceptance][message]")!, /droit de rétractation/);
  assert.equal(p.get("success_url"), "https://tafelmoord.be/fr/bedankt.html?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(p.get("metadata[product]"), "taart-fr");
});

test("FR-foutmelding bij ontbrekend vinkje", () => {
  assert.throws(() => buildCheckoutParams(cfg, req("taart-fr", false)), /Coche la case/);
});

test("checkout faalt met http-site", () => {
  assert.throws(() => buildCheckoutParams({ siteUrl: "http://x.be" }, req("oudejaar-nl")));
});

test("STRIPE_PRICES wordt streng gelezen", () => {
  assert.deepEqual(parsePriceIds(undefined), {});
  assert.deepEqual(parsePriceIds('{"taart-nl":"price_1"}'), { "taart-nl": "price_1" });
  assert.throws(() => parsePriceIds("{kapot"), /JSON/);
  assert.throws(() => parsePriceIds('{"onbekend":"price_1"}'), /onbekend product/);
  assert.throws(() => parsePriceIds('{"taart-nl":"prod_1"}'), /ongeldige prijs/);
  assert.throws(() => parsePriceIds("[]"), /object/);
});

test("stripeEncode nest arrays en objecten", () => {
  assert.deepEqual(stripeEncode({ a: [{ b: "c" }], d: { e: 1 }, f: undefined }), ["a%5B0%5D%5Bb%5D=c", "d%5Be%5D=1"]);
});

test("session-id validatie", () => {
  assert.ok(isValidSessionId("cs_test_a1B2c3D4e5F6g7H8"));
  assert.ok(isValidSessionId("cs_live_a1B2c3D4e5F6g7H8"));
  assert.ok(!isValidSessionId("cs_test_../../etc"));
  assert.ok(!isValidSessionId("pi_123"));
  assert.ok(!isValidSessionId(null));
});

const nowMs = Date.parse(NOW);
const paid = { id: "cs_test_x", payment_status: "paid", created: nowMs / 1000 - 3600, metadata: { product: "taart-fr" } };

test("download geeft het juiste bestand van het gekochte product", () => {
  const d = downloadDecision(paid, nowMs);
  assert.ok(d.ok);
  if (d.ok) assert.equal(d.product.file, "taart-fr.zip");
  const nl = downloadDecision({ ...paid, metadata: { product: "oudejaar-nl" } }, nowMs);
  assert.ok(nl.ok && nl.product.file === "oudejaar-nl.zip");
});

test("download geweigerd: onbetaald, onbekend product, te oud (met taal van het spel)", () => {
  const unpaid = downloadDecision({ ...paid, payment_status: "unpaid" }, nowMs) as any;
  assert.equal(unpaid.status, 402);
  assert.match(unpaid.reason, /Paiement/);
  assert.equal((downloadDecision({ ...paid, metadata: { product: "iets" } }, nowMs) as any).status, 404);
  assert.equal((downloadDecision({ ...paid, metadata: null }, nowMs) as any).status, 404);
  assert.equal((downloadDecision({ ...paid, created: nowMs / 1000 - 200 * 86400 }, nowMs) as any).status, 410);
  assert.ok(downloadDecision({ ...paid, created: nowMs / 1000 - 180 * 86400 }, nowMs).ok);
});

test("mail in de taal van het spel, met link naar de juiste bedankpagina", () => {
  const fr = downloadEmail("https://x.be", "cs_test_abc", CATALOG["taart-fr"]);
  assert.match(fr.subject, /Ton jeu est prêt/);
  assert.match(fr.html, /https:\/\/x\.be\/fr\/bedankt\.html\?session_id=cs_test_abc/);
  const nl = downloadEmail("https://x.be", "cs_test_abc", CATALOG["oudejaar-nl"]);
  assert.match(nl.subject, /Je spel staat klaar/);
  assert.match(nl.html, /\/nl\/bedankt\.html/);
});

test("Stripe-handtekening: geldig, fout geheim, gewijzigd, verlopen, ontbrekend", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1"}';
  const t = 1_800_000_000;
  const sig = await hmacSha256Hex(secret, `${t}.${payload}`);
  const header = `t=${t},v1=${sig}`;
  assert.equal(await verifyStripeSignature(payload, header, secret, t + 10), true);
  assert.equal(await verifyStripeSignature(payload, header, "whsec_fout", t + 10), false);
  assert.equal(await verifyStripeSignature(payload + " ", header, secret, t + 10), false);
  assert.equal(await verifyStripeSignature(payload, header, secret, t + 3600), false);
  assert.equal(await verifyStripeSignature(payload, null, secret, t), false);
  assert.equal(await verifyStripeSignature(payload, `t=${t},v0=${sig}`, secret, t), false);
});

test("HMAC komt overeen met bekende testvector (RFC 4231)", async () => {
  assert.equal(
    await hmacSha256Hex("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});
