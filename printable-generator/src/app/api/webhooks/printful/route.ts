import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePrintfulWebhook } from "@/lib/printful";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = parsePrintfulWebhook(body);

    switch (event.event) {
      case "shipped": {
        if (!event.externalId) break;
        await prisma.bookOrder.updateMany({
          where: { id: event.externalId },
          data: {
            status: "shipped",
            trackingUrl: event.trackingUrl || null,
            trackingNumber: event.trackingNumber || null,
          },
        });
        await prisma.coloringBook.updateMany({
          where: { orders: { some: { id: event.externalId } } },
          data: { status: "shipped" },
        });
        console.log(`[Printful] Shipped: order=${event.externalId}`);
        break;
      }

      case "failed": {
        if (!event.externalId) break;
        await prisma.bookOrder.updateMany({
          where: { id: event.externalId },
          data: { status: "failed" },
        });
        console.log(`[Printful] Failed: order=${event.externalId}`);
        break;
      }

      default:
        console.log(`[Printful] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Printful webhook error:", error);
    return NextResponse.json({ received: true }); // Always 200 to prevent retries
  }
}
