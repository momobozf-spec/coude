import { NextRequest, NextResponse } from "next/server";
import { stripe, planFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendUpgradeEmail, sendCommunityWelcomeEmail } from "@/lib/emails";
import { addCommunityMember, removeCommunityMember, generateSSOUrl } from "@/lib/circle";
import Stripe from "stripe";

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ────────────────────────────────────────────────────
      // 1. Checkout completed → activate subscription
      // ────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const metaType = session.metadata?.type;

        // ── Book order ──
        if (metaType === "book_order" && userId) {
          const bookOrderId = session.metadata?.bookOrderId;
          if (bookOrderId) {
            await prisma.bookOrder.update({
              where: { id: bookOrderId },
              data: { status: "paid", pricePaid: (session.amount_total || 0) / 100, stripeSessionId: session.id },
            });
            const bookOrder = await prisma.bookOrder.findUnique({ where: { id: bookOrderId }, select: { bookId: true } });
            if (bookOrder) {
              await prisma.coloringBook.update({ where: { id: bookOrder.bookId }, data: { status: "ordered" } });
            }
            console.log(`[Stripe] Book order paid: ${bookOrderId}`);
          }
          break;
        }

        // ── White Label purchase ──
        if (metaType === "white_label" && userId) {
          const plan = session.metadata?.plan || "basic";
          console.log(`[Stripe] White label purchase: user=${userId} plan=${plan}`);
          // Account created via /api/white-label/setup after payment
          break;
        }

        // ── Marketplace purchase ──
        if (metaType === "marketplace_purchase" && userId) {
          const productId = session.metadata?.productId;
          const buyerId = session.metadata?.buyerId;
          const sellerId = session.metadata?.sellerId;
          const sellerAmount = parseFloat(session.metadata?.sellerAmount || "0");
          const noorAmount = parseFloat(session.metadata?.noorAmount || "0");

          if (productId && buyerId) {
            const existing = await prisma.marketplacePurchase.findUnique({
              where: { buyerId_productId: { buyerId, productId } },
            });
            if (!existing) {
              await prisma.marketplacePurchase.create({
                data: {
                  buyerId,
                  productId,
                  pricePaid: (session.amount_total || 0) / 100,
                  sellerAmount,
                  noorAmount,
                  stripeSessionId: session.id,
                },
              });
              // Update product download count and seller earnings
              await prisma.marketplaceProduct.update({
                where: { id: productId },
                data: { downloads: { increment: 1 } },
              });
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
            }
            console.log(`[Stripe] Marketplace purchase: buyer=${buyerId} product=${productId} seller=${sellerId}`);
          }
          break;
        }

        // ── Ramadan Challenge purchase ──
        if (metaType === "ramadan_challenge" && userId) {
          const challengeId = session.metadata?.challengeId;
          const childName = session.metadata?.childName || "Child";
          const childAge = parseInt(session.metadata?.childAge || "6");
          if (challengeId) {
            const existing = await prisma.challengeEnrollment.findUnique({
              where: { userId_challengeId: { userId, challengeId } },
            });
            if (!existing) {
              await prisma.challengeEnrollment.create({
                data: {
                  userId,
                  challengeId,
                  childName,
                  childAge,
                  pricePaid: (session.amount_total || 0) / 100,
                },
              });
            }
            console.log(`[Stripe] Ramadan challenge purchase: user=${userId} child=${childName}`);
          }
          break;
        }

        // ── Course purchase (one-time payment) ──
        if (metaType === "course_purchase" && userId) {
          const courseId = session.metadata?.courseId;
          if (courseId) {
            const existing = await prisma.enrollment.findUnique({
              where: { userId_courseId: { userId, courseId } },
            });
            if (!existing) {
              await prisma.enrollment.create({
                data: {
                  userId,
                  courseId,
                  stripeSessionId: session.id,
                  pricePaid: (session.amount_total || 0) / 100,
                },
              });
            }
            console.log(`[Stripe] Course purchase: user=${userId} course=${courseId}`);
          }
          break;
        }

        // ── Subscription checkout ──
        const subscriptionId = session.subscription as string;
        const plan = session.metadata?.plan as "pro" | "school" | undefined;

        if (!userId || !subscriptionId) break;

        // Determine plan from metadata or from the subscription's price
        let resolvedPlan = plan;
        if (!resolvedPlan) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) resolvedPlan = planFromPriceId(priceId) ?? "pro";
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: resolvedPlan || "pro",
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: session.customer as string,
          },
        });

        console.log(`[Stripe] Checkout complete: user=${userId} plan=${resolvedPlan}`);

        // Send upgrade confirmation email
        const upgradedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (upgradedUser) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const amount = sub.items.data[0]?.price
            ? `${(sub.items.data[0].price.unit_amount! / 100).toFixed(2)} ${sub.items.data[0].price.currency.toUpperCase()}`
            : "—";
          const period = sub.items.data[0]?.price?.recurring?.interval === "year" ? "Yearly" : "Monthly";
          sendUpgradeEmail(upgradedUser.email, upgradedUser.name, resolvedPlan || "pro", amount, period).catch(() => {});

          // Add to Circle.so community
          const plan = resolvedPlan || "pro";
          if (plan === "pro" || plan === "school") {
            addCommunityMember({
              email: upgradedUser.email,
              name: upgradedUser.name,
              userId,
              plan,
            }).catch(() => {});

            const communityUrl = generateSSOUrl({
              email: upgradedUser.email,
              name: upgradedUser.name,
              userId,
            });
            sendCommunityWelcomeEmail(upgradedUser.email, upgradedUser.name, plan, communityUrl).catch(() => {});
          }
        }

        break;
      }

      // ────────────────────────────────────────────────────
      // 2. Subscription updated → update plan accordingly
      // ────────────────────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : null;

        if (subscription.status === "active" || subscription.status === "trialing") {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              plan: plan || "pro",
              stripeSubscriptionId: subscription.id,
            },
          });
          console.log(`[Stripe] Subscription active: customer=${customerId} plan=${plan}`);
        } else if (subscription.status === "past_due") {
          // Grace period — don't downgrade yet, just log
          // The invoice.payment_failed event handles the warning email
          console.log(`[Stripe] Subscription past_due: customer=${customerId}`);
        } else if (
          subscription.status === "canceled" ||
          subscription.status === "unpaid"
        ) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { plan: "free" },
          });
          console.log(`[Stripe] Subscription ${subscription.status}: customer=${customerId} → free`);
        }
        break;
      }

      // ────────────────────────────────────────────────────
      // 3. Subscription deleted → downgrade to free
      // ────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: "free",
            stripeSubscriptionId: null,
          },
        });

        // Remove from community
        const deletedUser = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { email: true },
        });
        if (deletedUser) {
          removeCommunityMember(deletedUser.email).catch(() => {});
        }

        console.log(`[Stripe] Subscription deleted: customer=${customerId} → free`);
        break;
      }

      // ────────────────────────────────────────────────────
      // 4. Payment failed → send warning, don't downgrade yet
      // ────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const attemptCount = invoice.attempt_count ?? 0;

        // Find the user
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, email: true, name: true, plan: true },
        });

        if (!user) break;

        if (attemptCount >= 3) {
          // After 3 failed attempts, downgrade
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: "free" },
          });
          console.log(`[Stripe] Payment failed 3x — downgraded: user=${user.id}`);

          // TODO: Send downgrade notification email
          // await sendEmail({
          //   to: user.email,
          //   subject: "Your Noor Printables subscription has been paused",
          //   body: `Hi ${user.name}, your payment failed after multiple attempts. Your account has been moved to the free plan. Update your payment method to restore access: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
          // });
        } else {
          // First or second failure — warn but keep access
          console.log(`[Stripe] Payment failed (attempt ${attemptCount}): user=${user.id} — keeping ${user.plan}`);

          // TODO: Send warning email
          // await sendEmail({
          //   to: user.email,
          //   subject: "Payment failed — please update your card",
          //   body: `Hi ${user.name}, we couldn't process your payment. Please update your payment method to avoid losing access: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
          // });
        }
        break;
      }

      default:
        // Unhandled event type — just acknowledge
        console.log(`[Stripe] Unhandled event: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe] Error handling ${event.type}:`, error);
    // Return 200 anyway to prevent Stripe from retrying endlessly
    // The error is logged and can be investigated
  }

  return NextResponse.json({ received: true });
}
