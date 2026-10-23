import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { createPendingOrder, releaseOrder } from "@/lib/orders";
import { brand } from "@/lib/brand";
import { fromCents } from "@/lib/money";
import { CheckoutError, checkoutRequestSchema, quoteCheckout, type PricedProduct } from "@/lib/checkout";

export async function POST(request: Request) {
  if (!isMollieConfigured()) {
    return NextResponse.json({ error: "Betalingen zijn nog niet geconfigureerd." }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Je moet ingelogd zijn om af te rekenen" }, { status: 401 });
  }

  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Controleer je gegevens en je winkelmandje" }, { status: 400 });
  }
  const req = parsed.data;

  try {
    // Alles opnieuw prijzen aan serverkant; prijzen uit de browser tellen niet.
    const productIds = [...new Set(req.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, stock: true, status: true },
    });
    const productMap = new Map<string, PricedProduct>(products.map((p) => [p.id, p]));

    const coupon = req.couponCode
      ? await prisma.couponCode.findUnique({ where: { code: req.couponCode.toUpperCase() } })
      : null;

    const quote = quoteCheckout(req.items, productMap, req.shippingMethod, coupon);
    if (quote.totalCents < 1) {
      return NextResponse.json({ error: "Een bestelling van € 0 kan niet afgerekend worden" }, { status: 400 });
    }

    const order = await createPendingOrder({
      userId: session.user.id,
      customerEmail: req.shippingAddress.email,
      address: req.shippingAddress,
      shippingMethod: req.shippingMethod,
      quote,
    });

    let payment;
    try {
      payment = await createMolliePayment({
        amount: fromCents(quote.totalCents),
        description: `${brand.name} bestelling ${order.orderNumber}`,
        redirectUrl: `${brand.url}/${req.locale}/checkout/success?order=${encodeURIComponent(order.orderNumber)}`,
        webhookUrl: `${brand.url}/api/webhooks/mollie`,
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        locale: req.locale,
      });
    } catch (err) {
      // Zonder betaling geen order: voorraad meteen terug.
      await releaseOrder(order.id, "FAILED");
      throw err;
    }

    await prisma.order.update({ where: { id: order.id }, data: { molliePaymentId: payment.id } });

    const checkoutUrl = payment._links.checkout?.href;
    if (!checkoutUrl) {
      await releaseOrder(order.id, "FAILED");
      return NextResponse.json({ error: "Kon de betaling niet starten" }, { status: 502 });
    }
    return NextResponse.json({ url: checkoutUrl, orderNumber: order.orderNumber });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[checkout] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het afrekenen" }, { status: 500 });
  }
}
