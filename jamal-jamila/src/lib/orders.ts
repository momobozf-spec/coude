import { prisma } from "@/lib/prisma";
import { formatOrderNumber } from "@/lib/brand";
import { sendOrderConfirmation, sendAdminNewOrder } from "@/lib/resend";

/**
 * Generate the next sequential, human-friendly order number.
 * Pass the active transaction client so the count is consistent within the
 * order-creating transaction. Format: LAYALI-2026-000042.
 */
export async function nextOrderNumber(
  tx: { order: { count: () => Promise<number> } },
  year = new Date().getFullYear(),
): Promise<string> {
  const count = await tx.order.count();
  return formatOrderNumber(count + 1, year);
}

/**
 * Idempotently mark a pre-created order as paid.
 *
 * Used by the Mollie webhook (and could be reused by any provider that creates
 * the order *before* payment). Safe to call multiple times — once an order is
 * PAID, repeat calls are no-ops, so duplicate webhook deliveries never double
 * decrement stock or resend emails.
 */
export async function fulfilPaidOrder(orderId: string, provider: string): Promise<void> {
  const fulfilled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      console.error(`[orders] fulfilPaidOrder: order ${orderId} not found`);
      return null;
    }
    // Idempotency guard — already processed.
    if (order.paymentStatus === "PAID") return null;

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "PAID", status: "PROCESSING", paymentProvider: provider },
    });

    // Decrement stock for each ordered item.
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Increment coupon usage if one was applied.
    if (order.couponCode) {
      await tx.couponCode.updateMany({
        where: { code: order.couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    return order;
  });

  if (!fulfilled) return;

  // Emails are best-effort and must never break the webhook response.
  try {
    if (fulfilled.customerEmail) {
      await sendOrderConfirmation(fulfilled.customerEmail, {
        orderNumber: fulfilled.orderNumber,
        total: fulfilled.total,
        subtotal: fulfilled.subtotal,
        shipping: fulfilled.shipping,
        discount: fulfilled.discount,
      });
    }
    await sendAdminNewOrder({
      orderNumber: fulfilled.orderNumber,
      total: fulfilled.total,
      customerEmail: fulfilled.customerEmail,
    });
  } catch (err) {
    console.error("[orders] email after payment failed:", err);
  }
}
