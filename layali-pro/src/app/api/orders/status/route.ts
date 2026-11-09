import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { applyMollieStatus } from "@/lib/orders";

/**
 * Status van een eigen bestelling, voor de bedankpagina.
 *
 * Staat de order nog op PENDING, dan vragen we Mollie zelf de status op. Zo
 * klopt de bedankpagina ook als de webhook (nog) niet binnen is; de webhook
 * blijft het hoofdpad.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const orderNumber = new URL(request.url).searchParams.get("order");
  if (!orderNumber || orderNumber.length > 40) {
    return NextResponse.json({ error: "Bestelnummer ontbreekt" }, { status: 400 });
  }

  const select = { id: true, orderNumber: true, paymentStatus: true, status: true, total: true, molliePaymentId: true } as const;
  let order = await prisma.order.findFirst({ where: { orderNumber, userId: session.user.id }, select });
  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden" }, { status: 404 });
  }

  if (order.paymentStatus === "PENDING" && order.molliePaymentId && isMollieConfigured()) {
    try {
      await applyMollieStatus(order.id, await getMolliePayment(order.molliePaymentId));
      order = (await prisma.order.findUnique({ where: { id: order.id }, select }))!;
    } catch (err) {
      console.error("[orders/status] Mollie-controle mislukt:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    status: order.status,
    total: order.total,
  });
}
