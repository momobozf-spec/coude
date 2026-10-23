import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, planFromPriceId } from "@/lib/stripe";
import { sendUpgradeEmail, sendCommunityWelcomeEmail } from "@/lib/emails";
import { addCommunityMember, removeCommunityMember, generateSSOUrl } from "@/lib/circle";
import { isFeatureEnabled } from "@/lib/features";

// Business logic for Stripe webhooks, separated from the route so it can be unit-tested.
// Signature verification + idempotency live in src/app/api/webhooks/stripe/route.ts.

type PaidPlan = "pro" | "school";

function asPaidPlan(value: unknown): PaidPlan | null {
  return value === "pro" || value === "school" ? value : null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function isPaid(session: Stripe.Checkout.Session): boolean {
  // "unpaid" = async payment method (SEPA Direct Debit, …) still pending: wait for
  // checkout.session.async_payment_succeeded before granting anything.
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!userId || !subscriptionId) return;

  // Source of truth = the Stripe price on the subscription; metadata only as fallback.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const price = sub.items.data[0]?.price;
  const plan = (price?.id ? planFromPriceId(price.id) : null) ?? asPaidPlan(session.metadata?.plan);
  if (!plan) {
    console.error(`[Stripe] Unknown price on subscription ${subscriptionId}; plan not changed`);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId(session.customer),
    },
  });
  console.log(`[Stripe] Checkout complete: user=${userId} plan=${plan}`);

  const upgradedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!upgradedUser) return;

  const amount =
    price?.unit_amount != null
      ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
      : "—";
  const period = price?.recurring?.interval === "year" ? "Yearly" : "Monthly";
  sendUpgradeEmail(upgradedUser.email, upgradedUser.name, plan, amount, period).catch(() => {});

  if (isFeatureEnabled("community")) {
    addCommunityMember({ email: upgradedUser.email, name: upgradedUser.name, userId, plan }).catch(() => {});
    const communityUrl = generateSSOUrl({ email: upgradedUser.email, name: upgradedUser.name, userId });
    sendCommunityWelcomeEmail(upgradedUser.email, upgradedUser.name, plan, communityUrl).catch(() => {});
  }
}

async function handleOneTimeCheckout(session: Stripe.Checkout.Session, metaType: string) {
  const userId = session.metadata?.userId;
  const amountPaid = (session.amount_total || 0) / 100;

  switch (metaType) {
    case "book_order": {
      if (!isFeatureEnabled("books")) break;
      const bookOrderId = session.metadata?.bookOrderId;
      if (!userId || !bookOrderId) break;
      const order = await prisma.bookOrder.findUnique({ where: { id: bookOrderId }, select: { bookId: true, userId: true } });
      if (!order || order.userId !== userId) break;
      await prisma.bookOrder.update({
        where: { id: bookOrderId },
        data: { status: "paid", pricePaid: amountPaid, stripeSessionId: session.id },
      });
      await prisma.coloringBook.update({ where: { id: order.bookId }, data: { status: "ordered" } });
      break;
    }
    case "white_label": {
      if (!isFeatureEnabled("whiteLabel")) break;
      // Account is created via /api/white-label/setup after payment.
      console.log(`[Stripe] White label purchase: user=${userId}`);
      break;
    }
    case "marketplace_purchase": {
      if (!isFeatureEnabled("marketplace")) break;
      const productId = session.metadata?.productId;
      const buyerId = session.metadata?.buyerId;
      const sellerId = session.metadata?.sellerId;
      const sellerAmount = parseFloat(session.metadata?.sellerAmount || "0");
      const noorAmount = parseFloat(session.metadata?.noorAmount || "0");
      if (!productId || !buyerId) break;
      const existing = await prisma.marketplacePurchase.findUnique({
        where: { buyerId_productId: { buyerId, productId } },
      });
      if (existing) break;
      await prisma.marketplacePurchase.create({
        data: { buyerId, productId, pricePaid: amountPaid, sellerAmount, noorAmount, stripeSessionId: session.id },
      });
      await prisma.marketplaceProduct.update({ where: { id: productId }, data: { downloads: { increment: 1 } } });
      if (sellerId) {
        await prisma.sellerProfile.updateMany({
          where: { userId: sellerId },
          data: {
            totalSales: { increment: 1 },
            totalEarnings: { increment: sellerAmount },
            payoutsPending: { increment: sellerAmount },
          },
        });
      }
      break;
    }
    case "ramadan_challenge": {
      if (!isFeatureEnabled("ramadanChallenge")) break;
      const challengeId = session.metadata?.challengeId;
      if (!userId || !challengeId) break;
      const existing = await prisma.challengeEnrollment.findUnique({
        where: { userId_challengeId: { userId, challengeId } },
      });
      if (existing) break;
      await prisma.challengeEnrollment.create({
        data: {
          userId,
          challengeId,
          childName: session.metadata?.childName || "Child",
          childAge: parseInt(session.metadata?.childAge || "6") || 6,
          pricePaid: amountPaid,
        },
      });
      break;
    }
    case "course_purchase": {
      if (!isFeatureEnabled("academy")) break;
      const courseId = session.metadata?.courseId;
      if (!userId || !courseId) break;
      const existing = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
      if (existing) break;
      await prisma.enrollment.create({
        data: { userId, courseId, stripeSessionId: session.id, pricePaid: amountPaid },
      });
      break;
    }
    default:
      console.log(`[Stripe] Unknown checkout type "${metaType}" ignored`);
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isPaid(session)) {
        console.log(`[Stripe] Checkout ${session.id} not paid yet (${session.payment_status}); waiting`);
        return;
      }
      const metaType = session.metadata?.type;
      if (metaType) return handleOneTimeCheckout(session, metaType);
      if (session.mode === "subscription") return handleSubscriptionCheckout(session);
      return;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const cid = customerId(subscription.customer);
      if (!cid) return;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = priceId ? planFromPriceId(priceId) : null;

      if (subscription.status === "active" || subscription.status === "trialing") {
        if (!plan) {
          console.error(`[Stripe] Unknown price ${priceId} on subscription ${subscription.id}; plan not changed`);
          return;
        }
        await prisma.user.updateMany({
          where: { stripeCustomerId: cid },
          data: { plan, stripeSubscriptionId: subscription.id },
        });
      } else if (
        subscription.status === "canceled" ||
        subscription.status === "unpaid" ||
        subscription.status === "incomplete_expired"
      ) {
        await prisma.user.updateMany({ where: { stripeCustomerId: cid }, data: { plan: "free" } });
      }
      // past_due / incomplete: grace period, no change.
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const cid = customerId(subscription.customer);
      if (!cid) return;
      await prisma.user.updateMany({
        where: { stripeCustomerId: cid, stripeSubscriptionId: subscription.id },
        data: { plan: "free", stripeSubscriptionId: null },
      });
      if (isFeatureEnabled("community")) {
        const deletedUser = await prisma.user.findFirst({ where: { stripeCustomerId: cid }, select: { email: true } });
        if (deletedUser) removeCommunityMember(deletedUser.email).catch(() => {});
      }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const cid = customerId(invoice.customer);
      if (!cid) return;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: cid }, select: { id: true, plan: true } });
      if (!user) return;
      if ((invoice.attempt_count ?? 0) >= 3) {
        await prisma.user.update({ where: { id: user.id }, data: { plan: "free" } });
        console.log(`[Stripe] Payment failed 3x — downgraded: user=${user.id}`);
      } else {
        console.log(`[Stripe] Payment failed (attempt ${invoice.attempt_count}): user=${user.id} — keeping ${user.plan}`);
      }
      return;
    }

    default:
      return;
  }
}
