import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  // bcrypt gebruikt maximaal 72 bytes; langer heeft geen zin en kost rekentijd.
  password: z.string().min(10).max(72),
});

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel registraties vanaf dit adres. Probeer het later opnieuw." }, { status: 429 });
  }

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const tooShort = parsed.error.issues.some((i) => i.path[0] === "password" && i.code === "too_small");
    return NextResponse.json(
      { error: tooShort ? "Wachtwoord moet minimaal 10 tekens bevatten" : "Naam, e-mail en wachtwoord zijn verplicht" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Er bestaat al een account met dit e-mailadres" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { name: parsed.data.name, email, password: await bcrypt.hash(parsed.data.password, 12) },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // Twee gelijktijdige registraties met hetzelfde adres: de unieke index beslist.
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Er bestaat al een account met dit e-mailadres" }, { status: 409 });
    }
    console.error("[register] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het registreren" }, { status: 500 });
  }
}
