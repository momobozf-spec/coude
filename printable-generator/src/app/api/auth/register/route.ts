import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { applyReferral, generateReferralCode, REFERRAL_BONUS } from "@/lib/referral";
import { sendWelcomeEmail, sendReferralBonusEmail } from "@/lib/emails";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password } = parsed.data;
    const referralCode = typeof body.ref === "string" && body.ref.trim() ? body.ref.trim() : undefined;

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        referralCode: generateReferralCode(email),
        termsAcceptedAt: new Date(),
      },
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(() => {});

    // Credit the referrer (once per user, idempotent — see applyReferral)
    if (referralCode) {
      const result = await applyReferral(user.id, referralCode).catch(() => null);
      if (result?.status === "applied") {
        sendReferralBonusEmail(
          result.referrer.email,
          result.referrer.name,
          name,
          REFERRAL_BONUS,
          result.referrer.bonusGenerations + REFERRAL_BONUS
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
