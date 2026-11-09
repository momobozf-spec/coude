import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShippingCost } from "@/lib/utils";
import { createMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { nextOrderNumber } from "@/lib/orders";
import { brand } from "@/lib/brand";

interface CheckoutItem {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export async function POST(request: Request) {
  try {
    if (!isMollieConfigured()) {
      return NextResponse.json(
        { error: "Betalingen zijn nog niet geconfigureerd. Stel MOLLIE_API_KEY in." },
        { status: 503 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Je moet ingelogd zijn om af te rekenen" }, { status: 401 });
    }

    const {
      items,
      shippingAddress,
      shippingMethod = "standard",
      couponCode,
      locale = "nl",
    } = (await request.json()) as {
      items: CheckoutItem[];
      shippingAddress: Record<string, unknown>;
      shippingMethod?: string;
      couponCode?: string;
      locale?: string;
    };

    if (!items?.length) {
      return NextResponse.json({ error: "Winkelmandje is leeg" }, { status: 400 });
    }
    if (!shippingAddress) {
      return NextResponse.json({ error: "Verzendadres is verplicht" }, { status: 400 });
    }

    // Re-price everything server-side (never trust client prices).
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== "ACTIVE") {
        return NextResponse.json({ error: `Product niet beschikbaar` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Onvoldoende voorraad voor ${product.name}` }, { status: 400 });
      }
      subtotal += product.price * item.quantity;
    }

    // Shipping.
    const shipping = shippingMethod === "express" ? 9.95 : getShippingCost(subtotal);

    // Coupon (optional) — validated server-side.
    let discount = 0;
    let appliedCoupon: string | null = null;
    if (couponCode) {
      const coupon = await prisma.couponCode.findUnique({ where: { code: couponCode.toUpperCase() } });
      const now = new Date();
      const valid =
        coupon &&
        coupon.active &&
        (!coupon.minOrder || subtotal >= coupon.minOrder) &&
        (!coupon.validFrom || coupon.validFrom <= now) &&
        (!coupon.expiresAt || coupon.expiresAt >= now) &&
        (!coupon.maxUses || coupon.usedCount < coupon.maxUses);
      if (valid && coupon) {
        discount =
          coupon.discountType === "PERCENTAGE"
            ? (subtotal * coupon.discountValue) / 100
            : Math.min(coupon.discountValue, subtotal);
        appliedCoupon = coupon.code;
      }
    }

    const total = Math.max(0, subtotal + shipping - discount);

    // Create the order up-front in PENDING state, then attach the Mollie payment.
    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx as unknown as { order: { count: () => Promise<number> } });
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: session.user.id,
          customerEmail: session.user.email ?? null,
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentProvider: "mollie",
          subtotal,
          shipping,
          discount,
          total,
          shippingAddress: shippingAddress as object,
          shippingMethod,
          couponCode: appliedCoupon,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId)!.price,
              size: item.size || null,
              color: item.color || null,
            })),
          },
        },
      });
      return created;
    });

    // Create the Mollie payment.
    const payment = await createMolliePayment({
      amount: total,
      description: `${brand.name} bestelling ${order.orderNumber}`,
      redirectUrl: `${brand.url}/${locale}/checkout/success?order=${order.orderNumber}`,
      webhookUrl: `${brand.url}/api/webhooks/mollie`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      locale,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { molliePaymentId: payment.id },
    });

    const checkoutUrl = payment._links.checkout?.href;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Kon betaling niet starten" }, { status: 502 });
    }

    return NextResponse.json({ url: checkoutUrl, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("Mollie checkout error:", error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het afrekenen" }, { status: 500 });
  }
}
