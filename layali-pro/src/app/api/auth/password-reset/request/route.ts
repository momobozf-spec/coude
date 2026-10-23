import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth";
import { createPasswordReset } from "@/lib/passwords";
import { sendPasswordReset } from "@/lib/resend";
import { brand } from "@/lib/brand";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().trim().email().max(254),
  locale: z.enum(["nl", "fr"]).catch("nl"),
});

/** Altijd hetzelfde antwoord, of het adres nu een account heeft of niet. */
const DONE = { ok: true };

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`pw-reset-ip:${ip}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel aanvragen. Probeer het later opnieuw." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);
  // Per adres maximaal drie mails per uur, zodat niemand een inbox kan bestoken.
  if (!rateLimit(`pw-reset-email:${email}`, 3, 60 * 60 * 1000).allowed) {
    return NextResponse.json(DONE);
  }

  try {
    const token = await createPasswordReset(email);
    if (token) {
      const link = `${brand.url}/${parsed.data.locale}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordReset(email, link);
    }
  } catch (error) {
    console.error("[password-reset] aanvraag mislukt:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json(DONE);
}
