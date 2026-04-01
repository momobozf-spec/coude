import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES, StripePriceKey } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  priceKey: z.enum(["pro_monthly", "pro_yearly", "school_monthly", "school_yearly"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({ priceKey: "pro_monthly" }));
    const parsed = checkoutSchema.safeParse(body);
    const priceKey: StripePriceKey = parsed.success ? parsed.data.priceKey : "pro_monthly";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Don't allow checkout if already on a paid plan
    if (user.plan !== "free") {
      return NextResponse.json(
        { error: "Already on a paid plan. Use billing portal to change plans." },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const plan = priceKey.startsWith("school") ? "school" : "pro";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "ideal", "bancontact", "sepa_debit"],
      line_items: [{ price: STRIPE_PRICES[priceKey], quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=${plan}`,
      cancel_url: `${appUrl}/dashboard?cancelled=true`,

      // Promo codes enabled for Ramadan campaigns etc.
      allow_promotion_codes: true,

      // Store user+plan info so the webhook can resolve them
      metadata: {
        userId: user.id,
        plan,
        priceKey,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
        },
      },

      // Tax collection (for EU VAT)
      // Uncomment when Stripe Tax is enabled:
      // automatic_tax: { enabled: true },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
