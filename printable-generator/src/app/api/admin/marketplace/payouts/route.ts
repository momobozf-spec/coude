import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTransfer } from "@/lib/stripe-connect";

export async function GET(req: NextRequest) {
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get marketplace stats
  const [totalProducts, pendingReview, totalPurchases, totalGMV] = await Promise.all([
    prisma.marketplaceProduct.count({ where: { isPublished: true } }),
    prisma.marketplaceProduct.count({ where: { isPublished: false, isApproved: false } }),
    prisma.marketplacePurchase.count(),
    prisma.marketplacePurchase.aggregate({ _sum: { pricePaid: true } }),
  ]);

  // Sellers with pending payouts
  const sellers = await prisma.sellerProfile.findMany({
    where: { payoutsPending: { gt: 0 } },
    select: { id: true, displayName: true, payoutsPending: true, stripeAccountId: true },
  });

  return NextResponse.json({
    stats: {
      totalProducts,
      pendingReview,
      totalPurchases,
      totalGMV: totalGMV._sum.pricePaid || 0,
    },
    pendingPayouts: sellers,
  });
}

export async function POST(req: NextRequest) {
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Process payouts for all sellers with balance >= $25
    const sellers = await prisma.sellerProfile.findMany({
      where: { payoutsPending: { gte: 25 }, stripeAccountId: { not: null } },
    });

    const results: { sellerId: string; amount: number; status: string }[] = [];

    for (const seller of sellers) {
      if (!seller.stripeAccountId) continue;

      try {
        const transferId = await createTransfer(
          seller.payoutsPending,
          seller.stripeAccountId,
          `Noor Marketplace payout — ${seller.displayName}`
        );

        await prisma.sellerPayout.create({
          data: {
            sellerId: seller.id,
            amount: seller.payoutsPending,
            status: "paid",
            stripeTransferId: transferId,
            periodStart: new Date(new Date().setDate(1)),
            periodEnd: new Date(),
          },
        });

        await prisma.sellerProfile.update({
          where: { id: seller.id },
          data: {
            payoutsPaid: { increment: seller.payoutsPending },
            payoutsPending: 0,
          },
        });

        results.push({ sellerId: seller.id, amount: seller.payoutsPending, status: "paid" });
      } catch (err) {
        console.error(`Payout failed for seller ${seller.id}:`, err);
        results.push({ sellerId: seller.id, amount: seller.payoutsPending, status: "failed" });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("Batch payout error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
