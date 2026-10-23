import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMolliePayment } from "@/lib/mollie";
import { applyMollieStatus } from "@/lib/orders";

/**
 * Mollie-webhook.
 *
 * Mollie stuurt alleen `id=tr_xxx`. De status in het verzoek vertrouwen we
 * nooit: we halen de betaling op bij Mollie met onze geheime sleutel en
 * handelen op die status. Een vervalst verzoek kan dus hoogstens een echte
 * statusopvraging uitlokken.
 *
 * Idempotent: applyMollieStatus() doet niets meer zodra de order betaald of
 * geannuleerd is, dus herhaalde webhooks zijn veilig.
 */
const PAYMENT_ID = /^tr_[A-Za-z0-9]{4,40}$/;

export async function POST(request: Request) {
  let paymentId: string | null = null;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = (await request.json().catch(() => ({}))) as { id?: unknown };
      paymentId = typeof json.id === "string" ? json.id : null;
    } else {
      const form = await request.formData().catch(() => null);
      const id = form?.get("id");
      paymentId = typeof id === "string" ? id : null;
    }
  } catch {
    paymentId = null;
  }

  if (!paymentId || !PAYMENT_ID.test(paymentId)) {
    return NextResponse.json({ error: "Ongeldige betaling" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({ where: { molliePaymentId: paymentId }, select: { id: true } });
    if (!order) {
      // Onbekende betaling: bevestigen zodat Mollie stopt met opnieuw proberen.
      console.warn(`[mollie] webhook voor onbekende betaling ${paymentId}`);
      return NextResponse.json({ received: true });
    }

    const payment = await getMolliePayment(paymentId);
    if (payment.metadata && payment.metadata.orderId !== order.id) {
      console.error(`[mollie] betaling ${paymentId} hoort volgens Mollie bij een andere order`);
      return NextResponse.json({ received: true });
    }

    await applyMollieStatus(order.id, payment);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[mollie] webhook mislukt:", error instanceof Error ? error.message : error);
    // 500: Mollie probeert later opnieuw — juist bij tijdelijke fouten.
    return NextResponse.json({ error: "Webhook kon niet verwerkt worden" }, { status: 500 });
  }
}
