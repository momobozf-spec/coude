import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { createDownloadToken } from "@/lib/signed-download";

interface Props { params: Promise<{ purchaseId: string }> }

export const dynamic = "force-dynamic";

// Issues a short-lived signed download link for a purchase owned by the logged-in buyer.
// The storage location of the file is never returned.
export async function GET(_req: NextRequest, { params }: Props) {
  const user = await requireUser();
  if (!user.ok) return user.response;

  try {
    const { purchaseId } = await params;
    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      select: { id: true, buyerId: true, downloadCount: true, maxDownloads: true },
    });

    if (!purchase || purchase.buyerId !== user.userId) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Atomic: only increments while below the limit (no race between parallel requests).
    const updated = await prisma.marketplacePurchase.updateMany({
      where: { id: purchase.id, buyerId: user.userId, downloadCount: { lt: purchase.maxDownloads } },
      data: { downloadCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: `Download limit reached (${purchase.maxDownloads} downloads max)` }, { status: 403 });
    }

    const token = createDownloadToken({ purchaseId: purchase.id, userId: user.userId });
    return NextResponse.json({
      downloadUrl: `/api/marketplace/file?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 300,
      downloadsRemaining: Math.max(0, purchase.maxDownloads - purchase.downloadCount - 1),
    });
  } catch (error) {
    console.error("Download error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
