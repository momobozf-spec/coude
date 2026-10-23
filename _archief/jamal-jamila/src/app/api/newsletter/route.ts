import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const locale = body.locale === "fr" ? "fr" : "nl";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
    }

    // Idempotent — re-subscribing is a no-op.
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { locale },
      create: { email, locale },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Newsletter error:", error);
    return NextResponse.json({ error: "Er is een fout opgetreden." }, { status: 500 });
  }
}
