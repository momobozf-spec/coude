import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { fulfilPaidOrder } from "@/lib/orders";

/**
 * Returns the payment/order status for the current user's order.
 *
 * If the order is still PENDING and has a Mollie payment, we reconcile with
 * Mollie here too. This makes the success page reliable even when the webhook
 * could not reach us (e.g. local development without a public tunnel) — the
 * webhook remains the primary path in production.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get("order");
  if (!orderNumber) {
    return NextResponse.json({ error: "Missing order" }, { status: 400 });
  }

  let order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.user.id },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Reconcile with Mollie if still awaiting payment confirmation.
  if (order.paymentStatus === "PENDING" && order.molliePaymentId && isMollieConfigured()) {
    try {
      const payment = await getMolliePayment(order.molliePaymentId);
      if (payment.status === "paid") {
        await fulfilPaidOrder(order.id, "mollie");
      } else if (["failed", "canceled", "expired"].includes(payment.status)) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: payment.status === "failed" ? "FAILED" : "CANCELLED", status: "CANCELLED" },
        });
      }
      order = (await prisma.order.findUnique({ where: { id: order.id } }))!;
    } catch (err) {
      console.error("[orders/status] Mollie reconcile failed:", err);
    }
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    status: order.status,
    total: order.total,
  });
}
