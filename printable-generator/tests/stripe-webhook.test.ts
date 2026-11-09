import { describe, it, expect, vi, afterEach } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { POST } from "@/app/api/webhooks/stripe/route";
import { createUser, req } from "./helpers";

const SECRET = "whsec_test_secret";
const signer = new Stripe("sk_test_unit_tests_only");
let n = 0;

function signed(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return req("/api/webhooks/stripe", { body: payload, headers: { "stripe-signature": header } });
}

function evt(type: string, object: Record<string, unknown>) {
  n++;
  return { id: `evt_test_${n}_${Date.now()}`, object: "event", type, data: { object }, api_version: "2026-03-25.dahlia", created: 1, livemode: false, pending_webhooks: 0, request: null };
}

function mockSubscription(priceId: string) {
  return vi.spyOn(stripe.subscriptions, "retrieve").mockResolvedValue({
    id: "sub_1",
    items: { data: [{ price: { id: priceId, unit_amount: 1200, currency: "eur", recurring: { interval: "month" } } }] },
  } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("Stripe webhook", () => {
  it("rejects missing and invalid signatures", async () => {
    const r1 = await POST(req("/api/webhooks/stripe", { body: "{}" }));
    expect(r1.status).toBe(400);
    const r2 = await POST(req("/api/webhooks/stripe", { body: "{}", headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    expect(r2.status).toBe(400);
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = await POST(signed(evt("ping", {})));
    expect(r.status).toBe(500);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  it("activates the plan from the subscription price on a paid checkout", async () => {
    const u = await createUser();
    mockSubscription("price_school_y");
    const e = evt("checkout.session.completed", {
      id: "cs_1", object: "checkout.session", mode: "subscription", payment_status: "paid",
      subscription: "sub_1", customer: "cus_1", metadata: { userId: u.id, plan: "pro" },
    });
    const res = await POST(signed(e));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.plan).toBe("school"); // price wins over metadata
    expect(after?.stripeCustomerId).toBe("cus_1");
  });

  it("is idempotent: the same event delivered twice is processed once", async () => {
    const u = await createUser();
    const spy = mockSubscription("price_pro_m");
    const e = evt("checkout.session.completed", {
      id: "cs_2", object: "checkout.session", mode: "subscription", payment_status: "paid",
      subscription: "sub_2", customer: "cus_2", metadata: { userId: u.id },
    });
    const r1 = await POST(signed(e));
    const r2 = await POST(signed(e));
    expect(r1.status).toBe(200);
    expect(await r2.json()).toEqual({ received: true, duplicate: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await prisma.processedWebhookEvent.count({ where: { id: `stripe:${e.id}` } })).toBe(1);
  });

  it("does not activate an unpaid (async) checkout until async_payment_succeeded", async () => {
    const u = await createUser();
    mockSubscription("price_pro_m");
    const base = { id: "cs_3", object: "checkout.session", mode: "subscription", subscription: "sub_3", customer: "cus_3", metadata: { userId: u.id } };
    await POST(signed(evt("checkout.session.completed", { ...base, payment_status: "unpaid" })));
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.plan).toBe("free");
    await POST(signed(evt("checkout.session.async_payment_succeeded", { ...base, payment_status: "paid" })));
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.plan).toBe("pro");
  });

  it("ignores an unknown price instead of granting Pro", async () => {
    const u = await createUser();
    mockSubscription("price_unknown");
    await POST(signed(evt("checkout.session.completed", {
      id: "cs_4", object: "checkout.session", mode: "subscription", payment_status: "paid",
      subscription: "sub_4", customer: "cus_4", metadata: { userId: u.id },
    })));
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.plan).toBe("free");
  });

  it("downgrades on subscription.deleted", async () => {
    const u = await createUser({ plan: "pro", stripeCustomerId: "cus_5", stripeSubscriptionId: "sub_5" });
    const res = await POST(signed(evt("customer.subscription.deleted", { id: "sub_5", object: "subscription", customer: "cus_5", items: { data: [] } })));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.plan).toBe("free");
    expect(after?.stripeSubscriptionId).toBeNull();
  });

  it("ignores one-time checkouts of disabled modules (e.g. marketplace)", async () => {
    const buyer = await createUser();
    const res = await POST(signed(evt("checkout.session.completed", {
      id: "cs_6", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 500,
      metadata: { type: "marketplace_purchase", userId: buyer.id, buyerId: buyer.id, productId: "p_x" },
    })));
    expect(res.status).toBe(200);
    expect(await prisma.marketplacePurchase.count({ where: { buyerId: buyer.id } })).toBe(0);
  });

  it("on a processing error returns 500 and releases the idempotency marker so Stripe retries", async () => {
    const u = await createUser();
    vi.spyOn(stripe.subscriptions, "retrieve").mockRejectedValue(new Error("stripe down"));
    const e = evt("checkout.session.completed", {
      id: "cs_7", object: "checkout.session", mode: "subscription", payment_status: "paid",
      subscription: "sub_7", customer: "cus_7", metadata: { userId: u.id },
    });
    const res = await POST(signed(e));
    expect(res.status).toBe(500);
    expect(await prisma.processedWebhookEvent.count({ where: { id: `stripe:${e.id}` } })).toBe(0);
  });
});
