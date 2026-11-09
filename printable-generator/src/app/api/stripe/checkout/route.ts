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
    const priceId = STRIPE_PRICES[priceKey];
    if (!priceId) {
      return NextResponse.json({ error: "This plan is not available yet." }, { status: 503 });
    }

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
      // Payment methods (card, Bancontact, iDEAL, SEPA…) are managed in the Stripe
      // Dashboard (dynamic payment methods) instead of being hard-coded here.
      locale: "auto",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=${plan}`,
      cancel_url: `${appUrl}/dashboard?cancelled=true`,

      // Consumer law (WER art. VI.47 / VI.53): the customer asks for immediate start and
      // acknowledges the consequence for the 14-day right of withdrawal.
      custom_text: {
        submit: {
          message:
            "Door te betalen vraag je dat je abonnement meteen start. Je behoudt 14 dagen herroepingsrecht; bij herroeping betaal je voor de reeds geleverde periode. / By paying you ask for immediate start. You keep a 14-day right of withdrawal; on withdrawal you pay for the period already provided.",
        },
      },

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

      // EU VAT via Stripe Tax (enable Stripe Tax in the dashboard first, then set
      // STRIPE_AUTOMATIC_TAX=true).
      ...(process.env.STRIPE_AUTOMATIC_TAX === "true"
        ? {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            customer_update: { address: "auto" as const, name: "auto" as const },
          }
        : {}),
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
