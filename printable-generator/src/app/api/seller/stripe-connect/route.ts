import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createConnectAccount, createOnboardingLink, getAccountStatus } from "@/lib/stripe-connect";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!seller) return NextResponse.json({ error: "Not a seller" }, { status: 403 });

    // If already has Connect account, return status
    if (seller.stripeAccountId) {
      const status = await getAccountStatus(seller.stripeAccountId);
      return NextResponse.json({ connected: true, ...status });
    }

    // Create new Connect account
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const accountId = await createConnectAccount(user.email, seller.id);

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { stripeAccountId: accountId },
    });

    const onboardingUrl = await createOnboardingLink(accountId);

    return NextResponse.json({ connected: false, onboardingUrl });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
