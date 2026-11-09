import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation, sendAdminNewOrder } from "@/lib/resend";
import { nextOrderNumber } from "@/lib/orders";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata?.userId || !metadata?.items) {
      console.error("Missing metadata in checkout session");
      return NextResponse.json(
        { error: "Missing metadata" },
        { status: 400 }
      );
    }

    try {
      const items = JSON.parse(metadata.items) as Array<{
        productId: string;
        quantity: number;
        size?: string;
        color?: string;
      }>;

      const shippingAddress = metadata.shippingAddress
        ? JSON.parse(metadata.shippingAddress)
        : null;

      const subtotal = parseFloat(metadata.subtotal || "0");
      const shipping = parseFloat(metadata.shipping || "0");
      const total = subtotal + shipping;

      // Idempotency: skip if we already recorded this payment.
      const existing = await prisma.order.findUnique({
        where: { stripePaymentId: session.payment_intent as string },
      });
      if (existing) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Create order and order items, decrement stock in a transaction
      const order = await prisma.$transaction(async (tx) => {
        const orderNumber = await nextOrderNumber(
          tx as unknown as { order: { count: () => Promise<number> } },
        );
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: metadata.userId,
            customerEmail: session.customer_email ?? null,
            status: "PROCESSING",
            paymentStatus: "PAID",
            paymentProvider: "stripe",
            subtotal,
            shipping,
            total,
            shippingAddress,
            shippingMethod: metadata.shippingMethod || "standard",
            stripePaymentId: session.payment_intent as string,
          },
        });

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) continue;

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
              size: item.size || null,
              color: item.color || null,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        return order;
      });

      // Send confirmation + admin notification emails (best-effort).
      try {
        if (session.customer_email) {
          await sendOrderConfirmation(session.customer_email, {
            orderNumber: order.orderNumber,
            total,
            subtotal,
            shipping,
            discount: 0,
          });
        }
        await sendAdminNewOrder({
          orderNumber: order.orderNumber,
          total,
          customerEmail: session.customer_email,
        });
      } catch (emailError) {
        console.error("Failed to send order emails:", emailError);
      }
    } catch (dbError) {
      console.error("Failed to create order:", dbError);
      return NextResponse.json(
        { error: "Failed to process order" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
