import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { applyMollieStatus, releaseOrder } from "@/lib/orders";

/**
 * Vangnet voor gemiste webhooks. Loopt de openstaande bestellingen af die
 * ouder zijn dan een half uur:
 * - met een Mollie-betaling: status bij Mollie opvragen en toepassen;
 * - zonder Mollie-betaling (het aanmaken liep halverwege mis): annuleren en
 *   de gereserveerde voorraad vrijgeven.
 *
 * Aanroepen met `Authorization: Bearer <CRON_SECRET>` (GitHub Actions, elk uur).
 * Zonder CRON_SECRET staat deze route uit.
 */
const BATCH = 50;
const MIN_AGE_MS = 30 * 60 * 1000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - MIN_AGE_MS);
  const pending = await prisma.order.findMany({
    where: { paymentStatus: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, molliePaymentId: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let checked = 0;
  let released = 0;
  let failed = 0;
  for (const order of pending) {
    try {
      if (!order.molliePaymentId) {
        if (await releaseOrder(order.id, "FAILED")) released++;
        continue;
      }
      if (!isMollieConfigured()) continue;
      await applyMollieStatus(order.id, await getMolliePayment(order.molliePaymentId));
      checked++;
    } catch (error) {
      failed++;
      console.error(`[reconcile] order ${order.id}:`, error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json({ pending: pending.length, checked, released, failed });
}

export const dynamic = "force-dynamic";
