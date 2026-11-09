import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SubStatus } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { track } from "@/lib/track";
import { describeError, logger } from "@/lib/logger";

// Signature verification needs the raw body and Node crypto, so this route must
// not run on the edge and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapStatus(status: Stripe.Subscription.Status): SubStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      // incomplete / paused — the customer has no usable access yet.
      return "NONE";
  }
}

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Since API version 2025-03-31 the period lives on the subscription *item*,
 * not on the subscription itself.
 */
function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0];
  if (!item || typeof item.current_period_end !== "number") return null;
  return new Date(item.current_period_end * 1000);
}

/** metadata.userId first, Stripe customer id as fallback. */
async function resolveUserId(
  metadataUserId: string | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (metadataUserId) {
    const byId = await db.user.findUnique({
      where: { id: metadataUserId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  if (customerId) {
    const byCustomer = await db.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }

  return null;
}

/**
 * Writes the subscription's *current* state onto the user.
 *
 * This is a straight overwrite rather than an increment, which is what makes
 * the endpoint idempotent: replaying the same event — or receiving it twice
 * because Stripe retried — lands on exactly the same row.
 */
async function syncSubscription(subscription: Stripe.Subscription, forceCanceled = false) {
  const customerId = customerIdOf(subscription.customer);
  const userId = await resolveUserId(subscription.metadata?.userId, customerId);

  if (!userId) {
    console.warn("stripe webhook: geen gebruiker voor subscription", subscription.id);
    return;
  }

  await db.user.update({
    where: { id: userId },
    data: {
      subStatus: forceCanceled ? "CANCELED" : mapStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEndOf(subscription),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });
}

const TRIAL_DAYS = 30;

/**
 * Creates the annual subscription after the €1 has actually been collected.
 *
 * Idempotent in two ways, because Stripe retries and because a customer could
 * in principle pay twice: an existing non-cancelled subscription short-circuits
 * the whole thing, and the created subscription is tagged with the session id.
 */
async function startTrialSubscription({
  userId,
  customerId,
  session,
}: {
  userId: string;
  customerId: string;
  session: Stripe.Checkout.Session;
}) {
  const priceId = process.env.STRIPE_PRICE_ANNUAL;
  if (!priceId) {
    console.error("stripe webhook: STRIPE_PRICE_ANNUAL ontbreekt");
    return;
  }

  const existing = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const live = existing.data.find(
    (subscription) =>
      subscription.status !== "canceled" && subscription.status !== "incomplete_expired",
  );

  if (live) {
    console.log(
      JSON.stringify({
        scope: "stripe.webhook",
        msg: "subscription already exists, skipping create",
        subscription: live.id,
      }),
    );
    await syncSubscription(live);
    return;
  }

  // The card Stripe saved during the €1 payment.
  const paymentIntentRef = session.payment_intent;
  let paymentMethodId: string | undefined;

  if (paymentIntentRef) {
    const paymentIntentId =
      typeof paymentIntentRef === "string" ? paymentIntentRef : paymentIntentRef.id;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const method = intent.payment_method;
    paymentMethodId = typeof method === "string" ? method : (method?.id ?? undefined);
  }

  const trialEnd = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86_400;

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId, quantity: 1 }],
    trial_end: trialEnd,
    ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
    // If the card fails at renewal, cancel rather than dunning a children's app
    // subscription for weeks.
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { userId, checkoutSession: session.id },
  });

  await db.user.update({
    where: { id: userId },
    data: { trialEndsAt: new Date(trialEnd * 1000), renewalReminderSentAt: null },
  });

  await syncSubscription(subscription);

  console.log(
    JSON.stringify({
      scope: "stripe.webhook",
      msg: "trial subscription created",
      subscription: subscription.id,
      trialEnd: new Date(trialEnd * 1000).toISOString(),
    }),
  );
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("stripe webhook: STRIPE_WEBHOOK_SECRET ontbreekt");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Must be the raw text: any JSON round-trip would invalidate the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("stripe webhook: ongeldige signature", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = customerIdOf(session.customer);
        const userId = await resolveUserId(
          session.client_reference_id ?? undefined,
          customerId,
        );

        if (!userId || !customerId) {
          console.warn("stripe webhook: geen gebruiker voor checkout", session.id);
          break;
        }

        await db.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });

        // The €1 has been paid. Now start the annual subscription on the card
        // Stripe just saved, with the first charge 30 days out.
        if (session.mode === "payment" && session.payment_status === "paid") {
          track("checkout_completed", {
            userId,
            amountCents: session.amount_total ?? 0,
          });
          await startTrialSubscription({ userId, customerId, session });
        }

        // A subscription-mode session (older flow) still syncs as before.
        const subscriptionRef = session.subscription;
        if (subscriptionRef) {
          const subscriptionId =
            typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object);
        break;
      }

      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object, true);
        break;
      }

      case "invoice.payment_failed": {
        // Resolved by customer rather than by subscription: the invoice's
        // subscription field moved between API versions, the customer did not.
        const invoice = event.data.object;
        const customerId = customerIdOf(invoice.customer);
        const userId = await resolveUserId(undefined, customerId);

        if (userId) {
          await db.user.update({
            where: { id: userId },
            data: { subStatus: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        // Everything else is acknowledged and ignored on purpose.
        break;
    }
  } catch (error) {
    console.error("stripe webhook: verwerking mislukt", event.type, error);
    // 500 makes Stripe retry, which is safe because every handler above is
    // idempotent.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
