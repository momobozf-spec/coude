import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSSOUrl } from "@/lib/circle";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, image: true, plan: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.plan !== "pro" && user.plan !== "school") {
      return NextResponse.json({
        error: "Community access requires Pro or School plan",
        upgradeUrl: "/dashboard",
      }, { status: 403 });
    }

    const ssoUrl = generateSSOUrl({
      email: user.email,
      name: user.name,
      userId: user.id,
      avatarUrl: user.image || undefined,
    });

    return NextResponse.json({
      ssoUrl,
      communityUrl: process.env.NEXT_PUBLIC_CIRCLE_URL || "https://noor-families.circle.so",
    });
  } catch (error) {
    console.error("Community join URL error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
