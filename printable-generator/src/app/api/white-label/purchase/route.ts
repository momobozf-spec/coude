import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { WL_PLANS } from "@/lib/white-label";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { plan, schoolName, contactEmail } = await req.json();
    const planConfig = WL_PLANS[plan as keyof typeof WL_PLANS];
    if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Noor White Label — ${planConfig.name} Plan`,
            description: `${planConfig.seats} teacher seats, 1 year access`,
          },
          unit_amount: planConfig.price * 100,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/white-label/setup?plan=${plan}&purchased=true`,
      cancel_url: `${appUrl}/white-label`,
      allow_promotion_codes: true,
      metadata: {
        type: "white_label",
        userId: user.id,
        plan,
        schoolName: schoolName || "",
        contactEmail: contactEmail || user.email,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("White label purchase error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
