import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["nl", "fr"]).catch("nl"),
});

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`newsletter:${ip}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel aanvragen. Probeer het later opnieuw." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }

  try {
    // Idempotent: opnieuw inschrijven verandert niets behalve de taal.
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      update: { locale: parsed.data.locale },
      create: { email: parsed.data.email, locale: parsed.data.locale },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[newsletter] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden." }, { status: 500 });
  }
}
