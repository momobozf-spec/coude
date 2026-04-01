import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { calculateSplit } from "@/lib/stripe-connect";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { productId } = await req.json();
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const product = await prisma.marketplaceProduct.findUnique({
      where: { id: productId, isPublished: true, isApproved: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Already purchased?
    const existing = await prisma.marketplacePurchase.findUnique({
      where: { buyerId_productId: { buyerId: session.user.id, productId } },
    });
    if (existing) return NextResponse.json({ error: "Already purchased", purchased: true }, { status: 409 });

    // Free product
    if (product.price === 0) {
      await prisma.marketplacePurchase.create({
        data: {
          buyerId: session.user.id,
          productId,
          pricePaid: 0,
          sellerAmount: 0,
          noorAmount: 0,
          stripeSessionId: "free",
        },
      });
      await prisma.marketplaceProduct.update({
        where: { id: productId },
        data: { downloads: { increment: 1 } },
      });
      return NextResponse.json({ success: true, free: true });
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, stripeCustomerId: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const { sellerAmount, noorAmount } = calculateSplit(product.price);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: product.currency.toLowerCase(),
          product_data: { name: product.title, description: `Islamic worksheet by ${product.sellerId}` },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/marketplace/${productId}?purchased=true`,
      cancel_url: `${appUrl}/marketplace/${productId}`,
      allow_promotion_codes: true,
      metadata: {
        type: "marketplace_purchase",
        productId,
        buyerId: session.user.id,
        sellerId: product.sellerId,
        sellerAmount: String(sellerAmount),
        noorAmount: String(noorAmount),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Purchase error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
