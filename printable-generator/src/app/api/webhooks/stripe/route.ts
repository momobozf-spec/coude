import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { handleStripeEvent } from "@/lib/stripe-webhook";

// Raw body is needed for signature verification.
export const dynamic = "force-dynamic";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Stripe] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe delivers at-least-once. Record the event id first; a duplicate
  // delivery hits the primary key and is acknowledged without re-processing.
  const eventKey = `stripe:${event.id}`;
  try {
    await prisma.processedWebhookEvent.create({
      data: { id: eventKey, provider: "stripe", type: event.type },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[Stripe] Could not record webhook event");
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    // Roll back the idempotency marker and return 500 so Stripe retries later.
    await prisma.processedWebhookEvent.delete({ where: { id: eventKey } }).catch(() => {});
    console.error(`[Stripe] Error handling ${event.type}:`, error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
