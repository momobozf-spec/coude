import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSignedUrl } from "@/lib/watermark";

interface Props { params: Promise<{ purchaseId: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { purchaseId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      include: { product: { select: { fileUrl: true, title: true } } },
    });

    if (!purchase || purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.downloadCount >= purchase.maxDownloads) {
      return NextResponse.json({ error: "Download limit reached (5 downloads max)" }, { status: 403 });
    }

    // Increment download count
    await prisma.marketplacePurchase.update({
      where: { id: purchaseId },
      data: { downloadCount: { increment: 1 } },
    });

    const signedUrl = generateSignedUrl(purchase.product.fileUrl);

    return NextResponse.json({ downloadUrl: signedUrl, downloadsRemaining: purchase.maxDownloads - purchase.downloadCount - 1 });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
