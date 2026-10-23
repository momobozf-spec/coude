import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { changePassword, newPasswordSchema } from "@/lib/passwords";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: newPasswordSchema,
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Je moet ingelogd zijn" }, { status: 401 });
  }
  if (!rateLimit(`pw-change:${session.user.id}`, 10, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het later opnieuw." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieuw wachtwoord moet minimaal 10 tekens bevatten" }, { status: 400 });
  }

  const result = await changePassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword);
  if (result === "wrong-password") {
    return NextResponse.json({ error: "Je huidige wachtwoord klopt niet" }, { status: 400 });
  }
  if (result === "no-password") {
    return NextResponse.json({ error: "Je meldt je aan met Google; er is geen wachtwoord om te wijzigen" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
