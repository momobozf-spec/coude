import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberByEmail } from "@/lib/circle";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, plan: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const hasAccess = user.plan === "pro" || user.plan === "school";
    let memberSince = null;

    if (hasAccess) {
      const member = await getMemberByEmail(user.email);
      if (member) memberSince = member.created_at;
    }

    return NextResponse.json({
      hasAccess,
      plan: user.plan,
      memberSince,
      upgradeUrl: hasAccess ? undefined : "/dashboard",
    });
  } catch (error) {
    console.error("Community status error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
