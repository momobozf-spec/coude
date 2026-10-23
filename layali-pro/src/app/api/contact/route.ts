import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactMessage, emailConfigured } from "@/lib/resend";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(5000),
});

/** Contactformulier → e-mail naar ADMIN_EMAIL, met het adres van de klant als reply-to. */
export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel berichten. Probeer het later opnieuw." }, { status: 429 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Het contactformulier is tijdelijk niet beschikbaar." }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vul alle velden correct in." }, { status: 400 });
  }
  try {
    await sendContactMessage(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact] versturen mislukt:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Je bericht kon niet verstuurd worden. Probeer het later opnieuw." }, { status: 502 });
  }
}
