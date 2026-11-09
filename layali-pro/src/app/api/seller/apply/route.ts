import { NextResponse } from "next/server";
import { marketplaceEnabled } from "@/lib/features";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendSellerApplication } from "@/lib/resend";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const schema = z.object({
  businessName: z.string().trim().min(1).max(150),
  contactName: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optional(40),
  offerType: z.enum(["PRODUCTS", "SERVICES", "BOTH"]).catch("PRODUCTS"),
  category: optional(100),
  description: optional(3000),
});

export async function POST(request: Request) {
  if (!marketplaceEnabled()) {
    return NextResponse.json({ error: "Niet beschikbaar" }, { status: 404 });
  }
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`seller-apply:${ip}`, 5, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel aanvragen. Probeer het later opnieuw." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vul de verplichte velden correct in." }, { status: 400 });
  }

  try {
    const application = await prisma.sellerApplication.create({ data: parsed.data });

    try {
      await sendSellerApplication(parsed.data);
    } catch (err) {
      console.error("[seller/apply] e-mail mislukt:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ ok: true, id: application.id });
  } catch (error) {
    console.error("[seller/apply] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden. Probeer opnieuw." }, { status: 500 });
  }
}
