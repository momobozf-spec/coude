import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: "pro",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });
      }
      break;
    }

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
      break;
    }
  }

  return NextResponse.json({ received: true });
}
