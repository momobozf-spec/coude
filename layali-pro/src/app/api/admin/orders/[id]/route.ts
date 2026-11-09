import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, firstIssue } from "@/lib/admin";
import { ORDER_STATUSES } from "@/lib/status";
import { cancelPaidOrder, releaseOrder } from "@/lib/orders";
import { sendShippingUpdate } from "@/lib/resend";

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  trackingNumber: z.string().trim().max(100).optional(),
  trackingUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://"), "Alleen https-links")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Statussen die alleen kunnen als de order betaald is. */
const NEEDS_PAYMENT = new Set(["PROCESSING", "SHIPPED", "DELIVERED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { status, trackingNumber, trackingUrl } = parsed.data;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Bestelling niet gevonden" }, { status: 404 });

    if (order.status === "CANCELLED" && status !== "CANCELLED") {
      return NextResponse.json({ error: "Een geannuleerde bestelling kan niet heropend worden" }, { status: 409 });
    }
    if (NEEDS_PAYMENT.has(status) && order.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "Deze bestelling is nog niet betaald" }, { status: 409 });
    }
    if (status === "PENDING" && order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Een betaalde bestelling kan niet terug naar 'in afwachting'" }, { status: 409 });
    }

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      if (order.paymentStatus === "PAID") {
        // Geld is ontvangen: annuleren en voorraad terug, terugbetalen gebeurt in Mollie.
        await cancelPaidOrder(id, order.status !== "SHIPPED" && order.status !== "DELIVERED");
      } else {
        await releaseOrder(id, "CANCELLED");
      }
    } else if (status !== order.status || trackingNumber !== undefined || trackingUrl !== undefined) {
      await prisma.order.update({
        where: { id },
        data: {
          status,
          ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber || null } : {}),
          ...(trackingUrl !== undefined ? { trackingUrl } : {}),
        },
      });
    }

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
    });

    if (status === "SHIPPED" && order.status !== "SHIPPED" && updated.customerEmail) {
      try {
        await sendShippingUpdate(updated.customerEmail, {
          orderNumber: updated.orderNumber,
          trackingNumber: updated.trackingNumber,
          trackingUrl: updated.trackingUrl,
        });
      } catch (err) {
        console.error("[admin/orders] verzendmail mislukt:", err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[admin/orders] bijwerken mislukt:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het bijwerken van de bestelling" }, { status: 500 });
  }
}
