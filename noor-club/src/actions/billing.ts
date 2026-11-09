"use server";

import { redirect } from "next/navigation";
import { stripe, requireStripeEnv } from "@/lib/stripe";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/entitlement";
import { toLocale } from "@/lib/locales";
import { describeError, hashed, logger } from "@/lib/logger";
import { track } from "@/lib/track";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * The tripwire: €1 today, €79/year after 30 days.
 *
 * Deliberately `mode: "payment"` and not a subscription with a trial. A trialing
 * subscription bills its first invoice at €0 and only charges the card when the
 * trial ends — so the €1 is not actually collected, the card is never proven to
 * work, and on day 30 you get a wall of failed renewals from cards that were
 * never valid. Here the €1 is charged now, `setup_future_usage` keeps the card
 * on file, and the webhook creates the annual subscription with `trial_end` set
 * to 30 days out using that same card.
 *
 * `redirect()` throws, so it never sits inside the try block.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const locale = toLocale(String(formData.get("locale") ?? ""));
  const consented = String(formData.get("waiveWithdrawal") ?? "") === "on";
  const user = await requireUser();
  const log = logger("billing.checkout");

  // An unreachable paying customer is the expensive kind: they never get the
  // day-23 reminder and dispute the renewal instead. The button is already
  // disabled in the UI; this is the half that actually enforces it.
  if (!user.emailVerifiedAt) {
    log.warn("checkout refused: e-mail not verified", { user: hashed(user.id) });
    redirect(`/${locale}/account?billing=unverified`);
  }

  if (!consented) {
    log.warn("checkout refused: withdrawal waiver not given", { user: hashed(user.id) });
    redirect(`/${locale}/account?billing=consent`);
  }

  let checkoutUrl: string | null = null;

  try {
    requireStripeEnv();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Recorded before leaving for Stripe: this is the moment consent was given.
    await db.user.update({
      where: { id: user.id },
      data: { withdrawalWaivedAt: new Date() },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_TRIPWIRE ?? "", quantity: 1 }],
      payment_intent_data: {
        // Keeps the card usable for the annual charge without asking again.
        setup_future_usage: "off_session",
        metadata: { userId: user.id, purpose: "tripwire" },
      },
      metadata: { userId: user.id, purpose: "tripwire" },
      allow_promotion_codes: true,
      locale: stripeLocale(locale),
      success_url: `${APP}/${locale}/account?welcome=1`,
      cancel_url: `${APP}/${locale}/account?canceled=1`,
    });

    checkoutUrl = session.url;
    log.info("checkout session created", {
      user: hashed(user.id),
      session: session.id,
      mode: "payment",
    });
    track("checkout_started", { userId: user.id, locale, amountCents: 100 });
  } catch (error) {
    log.error("checkout failed", { user: hashed(user.id), ...describeError(error) });
  }

  if (!checkoutUrl) {
    redirect(`/${locale}/account?billing=error`);
  }

  redirect(checkoutUrl);
}

export async function openPortal(formData: FormData): Promise<void> {
  const locale = toLocale(String(formData.get("locale") ?? ""));
  const user = await requireUser();
  const log = logger("billing.portal");

  if (!user.stripeCustomerId) {
    redirect(`/${locale}/account`);
  }

  let portalUrl: string | null = null;

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP}/${locale}/account`,
      locale: stripeLocale(locale),
    });
    portalUrl = portal.url;
  } catch (error) {
    log.error("portal failed", { user: hashed(user.id), ...describeError(error) });
  }

  if (!portalUrl) {
    redirect(`/${locale}/account?billing=error`);
  }

  redirect(portalUrl);
}

/** Our four locales all exist in Stripe's hosted-page locale list. */
function stripeLocale(locale: string): "nl" | "en" | "fr" | "de" {
  switch (locale) {
    case "en":
      return "en";
    case "fr":
      return "fr";
    case "de":
      return "de";
    default:
      return "nl";
  }
}
