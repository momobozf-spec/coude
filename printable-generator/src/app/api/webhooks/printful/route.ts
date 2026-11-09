import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parsePrintfulWebhook } from "@/lib/printful";
import { isFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

// Printful (API v1) webhooks are not signed. Protection here:
//  1. The webhook is OFF unless the books module is enabled AND PRINTFUL_WEBHOOK_SECRET is set.
//  2. The webhook URL registered at Printful must carry the secret:
//       https://<domain>/api/webhooks/printful?token=<PRINTFUL_WEBHOOK_SECRET>
//     compared in constant time.
//  3. The payload's Printful order id must match the printfulOrderId we stored for that
//     order, so a leaked token alone cannot flip arbitrary orders.

function tokenOk(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!isFeatureEnabled("books") || !secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!tokenOk(req.nextUrl.searchParams.get("token"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parsePrintfulWebhook(body);
  if (event.event === "unknown" || !event.externalId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const order = await prisma.bookOrder.findUnique({
    where: { id: event.externalId },
    select: { id: true, bookId: true, printfulOrderId: true, status: true },
  });
  if (!order || !order.printfulOrderId || order.printfulOrderId !== event.printfulOrderId) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  try {
    if (event.event === "shipped") {
      if (order.status !== "shipped" && order.status !== "delivered") {
        await prisma.bookOrder.update({
          where: { id: order.id },
          data: {
            status: "shipped",
            trackingUrl: event.trackingUrl || null,
            trackingNumber: event.trackingNumber || null,
          },
        });
        await prisma.coloringBook.update({ where: { id: order.bookId }, data: { status: "shipped" } });
      }
    } else if (event.event === "failed") {
      if (order.status !== "shipped" && order.status !== "delivered") {
        await prisma.bookOrder.update({ where: { id: order.id }, data: { status: "failed" } });
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Printful webhook error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
