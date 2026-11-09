import { NextResponse } from "next/server";
import { z } from "zod";
import { newPasswordSchema, resetPasswordWithToken } from "@/lib/passwords";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: newPasswordSchema,
});

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`pw-confirm:${ip}`, 20, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het later opnieuw." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Wachtwoord moet minimaal 10 tekens bevatten" }, { status: 400 });
  }
  try {
    const ok = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (!ok) {
      return NextResponse.json({ error: "Deze link is ongeldig of verlopen. Vraag een nieuwe aan." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[password-reset] bevestigen mislukt:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden." }, { status: 500 });
  }
}
