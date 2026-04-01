import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { BOOK_VARIANTS, BookVariant } from "@/lib/printful";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { bookId, quantity, shippingAddress, shippingCost } = await req.json();
    if (!bookId || !shippingAddress) return NextResponse.json({ error: "bookId and shippingAddress required" }, { status: 400 });

    const book = await prisma.coloringBook.findUnique({ where: { id: bookId } });
    if (!book || book.userId !== session.user.id) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const variant = BOOK_VARIANTS[book.variant as BookVariant] || BOOK_VARIANTS.softcover_20;
    const qty = quantity || 1;
    const unitPrice = variant.priceEur;
    const totalPrice = unitPrice * qty + (shippingCost || 4.99);

    // Create order record
    const order = await prisma.bookOrder.create({
      data: {
        userId: session.user.id,
        bookId,
        quantity: qty,
        unitPrice,
        totalPrice,
        shippingCost: shippingCost || 4.99,
        currency: "EUR",
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || null,
        city: shippingAddress.city,
        state: shippingAddress.state || null,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
        phone: shippingAddress.phone || null,
        pricePaid: 0,
      },
    });

    // Stripe Checkout
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, name: true, stripeCustomerId: true } });
    let customerId = user?.stripeCustomerId;
    if (!customerId && user) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: session.user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: `Noor Book: ${book.title}`, description: `${book.childName}'s personalized Islamic coloring book` },
          unit_amount: Math.round(totalPrice * 100),
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/books/order/${order.id}?paid=true`,
      cancel_url: `${appUrl}/books/create`,
      metadata: { type: "book_order", bookOrderId: order.id, bookId, userId: session.user.id },
    });

    return NextResponse.json({ url: checkoutSession.url, orderId: order.id });
  } catch (error) {
    console.error("Book order error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
