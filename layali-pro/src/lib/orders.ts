import { prisma, type AppPrismaClient } from "@/lib/prisma";
import { formatOrderNumber } from "@/lib/brand";
import { fromCents, toCents } from "@/lib/money";
import { CheckoutError, quantitiesPerProduct, type CheckoutQuote, type ShippingAddress } from "@/lib/checkout";
import { sendOrderConfirmation, sendAdminNewOrder } from "@/lib/resend";

/**
 * De levensloop van een bestelling:
 *
 *   createPendingOrder  → order PENDING, voorraad gereserveerd
 *   markOrderPaid       → PAID/PROCESSING (Mollie: paid)
 *   releaseOrder        → CANCELLED, voorraad terug (Mollie: failed/canceled/expired)
 *
 * Elke overgang gebeurt met een voorwaardelijke update, zodat dubbele
 * webhooks, de statuspagina en de reconcile-taak tegelijk mogen lopen zonder
 * dat er iets twee keer gebeurt.
 */

type Tx = Parameters<Parameters<AppPrismaClient["$transaction"]>[0]>[0];

/** Volgend ordernummer uit de Postgres-sequence: nooit dubbel, ook niet bij gelijktijdige bestellingen. */
async function nextOrderNumber(tx: Tx, now: Date): Promise<string> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  return formatOrderNumber(Number(rows[0]!.n), now.getFullYear());
}

/**
 * Reserveert de voorraad: per product één voorwaardelijke update
 * (`stock >= gevraagd`). Lukt dat voor één product niet, dan werpt de functie
 * en rolt de hele transactie terug. Zo kan er nooit meer verkocht worden dan
 * er is, ook niet als twee klanten tegelijk het laatste stuk afrekenen.
 */
async function reserveStock(tx: Tx, quantities: Map<string, number>, names: Map<string, string>): Promise<void> {
  for (const [productId, qty] of quantities) {
    const res = await tx.product.updateMany({
      where: { id: productId, status: "ACTIVE", stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (res.count !== 1) {
      throw new CheckoutError(`Onvoldoende voorraad voor ${names.get(productId) ?? "een product"}`, 409);
    }
  }
}

export interface PendingOrderInput {
  userId: string;
  customerEmail: string;
  address: ShippingAddress;
  shippingMethod: string;
  quote: CheckoutQuote;
}

export async function createPendingOrder(input: PendingOrderInput, now = new Date()) {
  const { quote } = input;
  const names = new Map(quote.lines.map((l) => [l.productId, l.productName]));

  return prisma.$transaction(async (tx) => {
    await reserveStock(tx, quantitiesPerProduct(quote.lines), names);
    const orderNumber = await nextOrderNumber(tx, now);
    return tx.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        customerEmail: input.customerEmail,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentProvider: "mollie",
        subtotal: fromCents(quote.subtotalCents),
        shipping: fromCents(quote.shippingCents),
        discount: fromCents(quote.discountCents),
        total: fromCents(quote.totalCents),
        shippingAddress: input.address,
        shippingMethod: input.shippingMethod,
        couponCode: quote.couponCode,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            price: fromCents(l.unitPriceCents),
            size: l.size ?? null,
            color: l.color ?? null,
          })),
        },
      },
    });
  });
}

/** De voorraad van een order terugzetten (binnen een transactie). */
async function restock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  for (const [productId, qty] of quantitiesPerProduct(items)) {
    await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
  }
}

/**
 * Een niet-betaalde order annuleren en de voorraad vrijgeven. Doet niets als
 * de order intussen betaald is of de voorraad al vrijgegeven werd.
 * Geeft true terug als deze aanroep de order effectief annuleerde.
 */
export async function releaseOrder(orderId: string, paymentStatus: "FAILED" | "CANCELLED", now = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { notIn: ["PAID", "REFUNDED"] }, stockReleasedAt: null },
      data: { paymentStatus, status: "CANCELLED", stockReleasedAt: now },
    });
    if (res.count !== 1) return false;
    await restock(tx, orderId);
    return true;
  });
}

/**
 * Een betaalde order annuleren (door de beheerder). De terugbetaling zelf
 * gebeurt in het Mollie-dashboard; de order krijgt daarom een opvolgnotitie.
 * `restockItems`: voorraad terugzetten (alleen als er nog niets verzonden is).
 */
export async function cancelPaidOrder(orderId: string, restockItems: boolean, now = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: "PAID", status: { not: "CANCELLED" } },
      data: {
        status: "CANCELLED",
        needsAttention: "Geannuleerd na betaling: terugbetalen via het Mollie-dashboard",
        ...(restockItems ? { stockReleasedAt: now } : {}),
      },
    });
    if (res.count !== 1) return false;
    if (restockItems) await restock(tx, orderId);
    return true;
  });
}

export interface PaymentConfirmation {
  /** Bedrag zoals de betaalprovider het meldt, bv. "24.95". */
  amountValue: string;
  currency: string;
  provider: string;
}

/**
 * Een order als betaald markeren. Idempotent: alleen de eerste aanroep doet
 * iets en verstuurt de e-mails.
 *
 * Bijzonder geval: de betaling kwam binnen nadat de order al verlopen was en
 * de voorraad terug vrijgegeven werd (bv. een late overschrijving). Het geld
 * is ontvangen, dus de order wordt betaald; we proberen de voorraad opnieuw te
 * reserveren en zetten de order op "opvolgen" als dat niet lukt.
 */
export async function markOrderPaid(orderId: string, payment: PaymentConfirmation, now = new Date()): Promise<boolean> {
  const paid = await prisma.$transaction(async (tx) => {
    // Eerst de voorwaardelijke update: die neemt het rijslot, zodat een
    // gelijktijdige releaseOrder() op dezelfde order moet wachten (of al klaar
    // is). Pas daarna lezen we de order, met de definitieve stockReleasedAt.
    const res = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { notIn: ["PAID", "REFUNDED"] } },
      data: { paymentStatus: "PAID", status: "PROCESSING", paymentProvider: payment.provider, paidAt: now },
    });
    if (res.count !== 1) return null;

    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;

    const problems: string[] = [];
    const expectedCents = toCents(order.total);
    const receivedCents = toCents(Number(payment.amountValue));
    if (payment.currency !== "EUR" || receivedCents !== expectedCents) {
      problems.push(
        `Betaald bedrag ${payment.currency} ${payment.amountValue} wijkt af van het orderbedrag EUR ${fromCents(expectedCents).toFixed(2)}`,
      );
    }

    if (order.stockReleasedAt) {
      // Voorraad was al vrijgegeven: opnieuw reserveren, maar nooit onder nul.
      for (const [productId, qty] of quantitiesPerProduct(order.items)) {
        const r = await tx.product.updateMany({
          where: { id: productId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (r.count !== 1) {
          const name = order.items.find((i) => i.productId === productId)?.productName ?? productId;
          problems.push(`Betaald na verlopen: onvoldoende voorraad voor ${name}`);
        }
      }
      await tx.order.update({ where: { id: orderId }, data: { stockReleasedAt: null } });
    }

    if (problems.length > 0) {
      await tx.order.update({ where: { id: orderId }, data: { needsAttention: problems.join("; ") } });
    }

    if (order.couponCode) {
      await tx.couponCode.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    }

    return order;
  });

  if (!paid) return false;

  // E-mails zijn best-effort en mogen de webhook nooit laten falen.
  try {
    if (paid.customerEmail) {
      await sendOrderConfirmation(paid.customerEmail, {
        orderNumber: paid.orderNumber,
        total: paid.total,
        subtotal: paid.subtotal,
        shipping: paid.shipping,
        discount: paid.discount,
      });
    }
    await sendAdminNewOrder({ orderNumber: paid.orderNumber, total: paid.total, customerEmail: paid.customerEmail });
  } catch (err) {
    console.error("[orders] e-mail na betaling mislukt:", err instanceof Error ? err.message : err);
  }
  return true;
}

/** Mollie-status → onze actie. */
export async function applyMollieStatus(
  orderId: string,
  payment: { status: string; amount: { value: string; currency: string } },
): Promise<void> {
  switch (payment.status) {
    case "paid":
      await markOrderPaid(orderId, { amountValue: payment.amount.value, currency: payment.amount.currency, provider: "mollie" });
      return;
    case "failed":
      await releaseOrder(orderId, "FAILED");
      return;
    case "canceled":
    case "expired":
      await releaseOrder(orderId, "CANCELLED");
      return;
    default:
      // open / pending / authorized: wachten op de volgende webhook.
      return;
  }
}
