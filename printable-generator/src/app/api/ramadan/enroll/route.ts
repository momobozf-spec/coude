import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { isEarlyBird } from "@/lib/ramadan";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { childName, childAge } = await req.json();
    if (!childName) return NextResponse.json({ error: "childName required" }, { status: 400 });

    const challenge = await prisma.ramadanChallenge.findFirst({ where: { isActive: true }, orderBy: { year: "desc" } });
    if (!challenge) return NextResponse.json({ error: "No active Ramadan challenge" }, { status: 404 });

    const existing = await prisma.challengeEnrollment.findUnique({
      where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } },
    });
    if (existing) return NextResponse.json({ error: "Already enrolled", enrolled: true }, { status: 409 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, stripeCustomerId: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const price = isEarlyBird(challenge.startDate) ? challenge.earlyPrice : challenge.price;

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
          product_data: { name: `30 Days of Ramadan Challenge ${challenge.year}`, description: `For ${childName} — Daily Islamic activities for 30 days` },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/ramadan-challenge/dashboard?enrolled=true`,
      cancel_url: `${appUrl}/ramadan-challenge`,
      allow_promotion_codes: true,
      metadata: {
        type: "ramadan_challenge",
        userId: user.id,
        challengeId: challenge.id,
        childName,
        childAge: String(childAge || 6),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Ramadan enroll error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
