import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, adminUnauthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();

  try {
    const { productId, approved, reason } = await req.json();
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    await prisma.marketplaceProduct.update({
      where: { id: productId },
      data: {
        isApproved: approved,
        isPublished: approved,
      },
    });

    console.log(`[Marketplace] Product ${productId} ${approved ? "APPROVED" : `REJECTED: ${reason}`}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
