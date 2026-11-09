import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { couponProblem } from "@/lib/checkout";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  /** Subtotaal in euro zoals de winkelmand het toont; alleen voor de minimumcontrole. */
  subtotal: z.number().finite().min(0).max(1_000_000).optional(),
});

/**
 * Controleert een kortingscode voor de winkelmand. Het echte bedrag wordt bij
 * het afrekenen opnieuw berekend; dit is alleen voor de weergave.
 * Rate-limited zodat niemand codes kan raden door ze massaal te proberen.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`coupon:${ip}`, 20, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het later opnieuw." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Kortingscode is verplicht" }, { status: 400 });
  }

  try {
    const coupon = await prisma.couponCode.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
    if (!coupon) {
      return NextResponse.json({ error: "Ongeldige kortingscode" }, { status: 404 });
    }
    const subtotalCents = Math.round((parsed.data.subtotal ?? Number.MAX_SAFE_INTEGER / 100) * 100);
    const problem = couponProblem(coupon, subtotalCents, new Date());
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    return NextResponse.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrder: coupon.minOrder,
    });
  } catch (error) {
    console.error("[coupons] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het controleren van de kortingscode" }, { status: 500 });
  }
}
