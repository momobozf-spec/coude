import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { displayName, bio, country } = await req.json();
    if (!displayName || !country) return NextResponse.json({ error: "displayName and country required" }, { status: 400 });

    const existing = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (existing) return NextResponse.json({ error: "Already a seller", sellerId: existing.id }, { status: 409 });

    const profile = await prisma.sellerProfile.create({
      data: {
        userId: session.user.id,
        displayName,
        bio: bio || "",
        country,
      },
    });

    return NextResponse.json({ success: true, sellerId: profile.id });
  } catch (error) {
    console.error("Seller register error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
