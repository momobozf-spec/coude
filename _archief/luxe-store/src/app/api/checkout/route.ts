import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { items, shippingAddress } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    // Fetch products from database to get accurate prices
    const productIds = items.map((i: { id: string }) => i.id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, archived: false },
    });

    if (products.length !== items.length) {
      return NextResponse.json(
        { error: "Some products are unavailable" },
        { status: 400 }
      );
    }

    // Validate stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      if (!product || product.stock < item.quantity) {
        return NextResponse.json(
          { error: `${product?.name || "Product"} is out of stock` },
          { status: 400 }
        );
      }
    }

    // Build line items for Stripe
    const lineItems = items.map((item: { id: string; quantity: number }) => {
      const product = products.find((p) => p.id === item.id)!;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: product.images.length > 0 ? [product.images[0]] : [],
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.quantity,
      };
    });

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: { id: string; quantity: number }) => {
      const product = products.find((p) => p.id === item.id)!;
      return sum + product.price * item.quantity;
    }, 0);
    const shipping = subtotal >= 150 ? 0 : 12.99;

    // Add shipping as a line item if applicable
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Shipping",
            images: [],
          },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    const user = session?.user as { id: string } | undefined;

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
      metadata: {
        userId: user?.id || "",
        items: JSON.stringify(
          items.map((i: { id: string; quantity: number }) => ({
            id: i.id,
            quantity: i.quantity,
          }))
        ),
        shippingAddress: JSON.stringify(shippingAddress),
        subtotal: subtotal.toString(),
        shipping: shipping.toString(),
      },
      customer_email: shippingAddress?.email,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
