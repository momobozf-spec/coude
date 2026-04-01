import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteToken, WL_PLANS } from "@/lib/white-label";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { subdomain, schoolName, schoolNameAr, country, city, studentCount, plan, logoUrl, primaryColor, secondaryColor, welcomeMessage, teacherEmails } = body;

    if (!subdomain || !schoolName || !plan) {
      return NextResponse.json({ error: "subdomain, schoolName, plan required" }, { status: 400 });
    }

    // Check subdomain availability
    const existing = await prisma.whiteLabelAccount.findUnique({ where: { subdomain } });
    if (existing) return NextResponse.json({ error: "Subdomain taken" }, { status: 409 });

    // Validate plan
    const planConfig = WL_PLANS[plan as keyof typeof WL_PLANS];
    if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    // Create account
    const account = await prisma.whiteLabelAccount.create({
      data: {
        subdomain: subdomain.toLowerCase(),
        adminUserId: session.user.id,
        schoolName,
        schoolNameAr: schoolNameAr || null,
        country: country || "",
        city: city || "",
        studentCount: studentCount || 0,
        plan,
        maxSeats: planConfig.seats,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || "#1a6b4a",
        secondaryColor: secondaryColor || "#c9920a",
        welcomeMessage: welcomeMessage || null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    // Set admin user's white label ID
    await prisma.user.update({
      where: { id: session.user.id },
      data: { whiteLabelId: account.id, whiteLabelRole: "admin" },
    });

    // Create teacher invitations
    if (teacherEmails && Array.isArray(teacherEmails)) {
      for (const email of teacherEmails.slice(0, planConfig.seats)) {
        if (email && email.includes("@")) {
          await prisma.whiteLabelInvite.create({
            data: {
              accountId: account.id,
              email: email.trim().toLowerCase(),
              token: generateInviteToken(),
            },
          }).catch(() => {}); // Skip duplicates
        }
      }
    }

    return NextResponse.json({
      success: true,
      accountId: account.id,
      subdomain: account.subdomain,
      url: `https://${account.subdomain}.noorprintables.com`,
    });
  } catch (error) {
    console.error("White label setup error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
