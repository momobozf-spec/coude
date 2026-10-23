import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { isAllowedFileUrl, verifyDownloadToken } from "@/lib/signed-download";

export const dynamic = "force-dynamic";

// Streams a purchased marketplace file. Requires BOTH a valid, unexpired signed token
// and a session of the same buyer. The file is fetched server-side from private storage
// (host must be in MARKETPLACE_FILE_HOSTS), so its URL never reaches the browser.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user.ok) return user.response;

  const token = req.nextUrl.searchParams.get("token") || "";
  const claims = verifyDownloadToken(token);
  if (!claims || claims.userId !== user.userId) {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
  }

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { id: claims.purchaseId },
    select: { buyerId: true, product: { select: { fileUrl: true, title: true } } },
  });
  if (!purchase || purchase.buyerId !== user.userId || !purchase.product.fileUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAllowedFileUrl(purchase.product.fileUrl)) {
    console.error("Marketplace file URL not on MARKETPLACE_FILE_HOSTS allow-list");
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  const headers: Record<string, string> = {};
  if (process.env.MARKETPLACE_FILE_AUTH_HEADER) {
    headers.Authorization = process.env.MARKETPLACE_FILE_AUTH_HEADER;
  }
  const upstream = await fetch(purchase.product.fileUrl, { headers, redirect: "error" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  const safeName = purchase.product.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "worksheet";
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
