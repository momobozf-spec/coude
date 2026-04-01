import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { generateReferralCode, REFERRAL_BONUS } from "@/lib/referral";
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
    const referralCode = body.ref as string | undefined;

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
        referredBy: referralCode || null,
      },
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(() => {});

    // Credit the referrer with bonus generations
    if (referralCode) {
      const referrer = await prisma.user.findFirst({
        where: { referralCode },
        select: { id: true, email: true, name: true, bonusGenerations: true },
      });

      if (referrer) {
        await prisma.user.update({
          where: { id: referrer.id },
          data: {
            referralCount: { increment: 1 },
            bonusGenerations: { increment: REFERRAL_BONUS },
          },
        });

        // Notify referrer (non-blocking)
        sendReferralBonusEmail(
          referrer.email,
          referrer.name,
          name,
          REFERRAL_BONUS,
          referrer.bonusGenerations + REFERRAL_BONUS
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
