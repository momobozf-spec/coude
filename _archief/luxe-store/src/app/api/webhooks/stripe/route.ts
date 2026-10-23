import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata!;

    const items = JSON.parse(metadata.items || "[]") as {
      id: string;
      quantity: number;
    }[];
    const subtotal = parseFloat(metadata.subtotal || "0");
    const shipping = parseFloat(metadata.shipping || "0");

    if (!metadata.userId || items.length === 0) {
      return NextResponse.json({ received: true });
    }

    // Fetch current prices from DB
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.id) } },
    });

    // Create order
    await prisma.order.create({
      data: {
        userId: metadata.userId,
        status: "PROCESSING",
        subtotal,
        total: subtotal + shipping,
        stripePaymentId: session.payment_intent as string,
        shippingAddress: metadata.shippingAddress
          ? JSON.parse(metadata.shippingAddress)
          : null,
        items: {
          create: items.map((item) => {
            const product = products.find((p) => p.id === item.id)!;
            return {
              productId: item.id,
              quantity: item.quantity,
              price: product.price,
            };
          }),
        },
      },
    });

    // Decrease stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.id },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }

  return NextResponse.json({ received: true });
}
