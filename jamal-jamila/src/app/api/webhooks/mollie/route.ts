import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMolliePayment } from "@/lib/mollie";
import { fulfilPaidOrder } from "@/lib/orders";

/**
 * Mollie webhook.
 *
 * Mollie POSTs `id=tr_xxx` (application/x-www-form-urlencoded) whenever a
 * payment changes state. We never trust the request body for the status —
 * instead we re-fetch the payment from Mollie's API (signature-equivalent
 * verification, since the call is authenticated with our secret key) and act on
 * the authoritative status.
 *
 * Idempotency: orders are looked up by molliePaymentId and fulfilPaidOrder()
 * is a no-op once an order is already PAID, so duplicate deliveries are safe.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let paymentId: string | null = null;

    if (contentType.includes("application/json")) {
      const json = await request.json().catch(() => ({}));
      paymentId = json.id ?? null;
    } else {
      const form = await request.formData();
      paymentId = (form.get("id") as string) ?? null;
    }

    if (!paymentId) {
      return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
    }

    // Authoritative status from Mollie.
    const payment = await getMolliePayment(paymentId);

    const order = await prisma.order.findUnique({ where: { molliePaymentId: paymentId } });
    if (!order) {
      // Unknown payment — acknowledge so Mollie stops retrying.
      console.warn(`[mollie] webhook for unknown payment ${paymentId}`);
      return NextResponse.json({ received: true });
    }

    switch (payment.status) {
      case "paid":
        await fulfilPaidOrder(order.id, "mollie");
        break;
      case "failed":
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED", status: "CANCELLED" } });
        break;
      case "canceled":
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "CANCELLED", status: "CANCELLED" } });
        break;
      case "expired":
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "CANCELLED", status: "CANCELLED" } });
        break;
      default:
        // open / pending / authorized — leave as PENDING, await final webhook.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Mollie webhook error:", error);
    // 500 makes Mollie retry — appropriate for transient failures.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
