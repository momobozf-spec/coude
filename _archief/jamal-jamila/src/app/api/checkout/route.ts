import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getShippingCost } from "@/lib/utils";

interface CheckoutItem {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Je moet ingelogd zijn om af te rekenen" },
        { status: 401 }
      );
    }

    const { items, shippingAddress, shippingMethod, locale = "nl" } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Winkelwagen is leeg" },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Verzendadres is verplicht" },
        { status: 400 }
      );
    }

    // Fetch products and validate stock
    const productIds = items.map((item: CheckoutItem) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const lineItems: {
      price_data: {
        currency: string;
        product_data: { name: string; images?: string[] };
        unit_amount: number;
      };
      quantity: number;
    }[] = [];

    let subtotal = 0;

    for (const item of items as CheckoutItem[]) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json(
          { error: `Product niet gevonden: ${item.productId}` },
          { status: 400 }
        );
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Onvoldoende voorraad voor ${product.name}` },
          { status: 400 }
        );
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      const description = [item.size, item.color].filter(Boolean).join(" / ");

      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: product.name,
            ...(product.images.length > 0 && { images: [product.images[0]] }),
            ...(description && { description }),
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.quantity,
      });
    }

    // Calculate shipping
    const shipping =
      shippingMethod === "express" ? 9.95 : getShippingCost(subtotal);

    // Add shipping as a line item
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: shippingMethod === "express" ? "Expresverzending" : "Standaardverzending",
          },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "ideal", "bancontact"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/checkout`,
      customer_email: session.user.email ?? undefined,
      metadata: {
        userId: session.user.id,
        items: JSON.stringify(items),
        shippingAddress: JSON.stringify(shippingAddress),
        subtotal: subtotal.toString(),
        shipping: shipping.toString(),
        shippingMethod: shippingMethod || "standard",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het afrekenen" },
      { status: 500 }
    );
  }
}
