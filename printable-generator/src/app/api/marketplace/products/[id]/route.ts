import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const session = await auth();

    const product = await prisma.marketplaceProduct.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, image: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { rating: true, comment: true, buyerId: true, createdAt: true },
        },
      },
    });

    if (!product || (!product.isPublished && product.sellerId !== session?.user?.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if current user purchased this
    let purchased = false;
    if (session?.user?.id) {
      const purchase = await prisma.marketplacePurchase.findUnique({
        where: { buyerId_productId: { buyerId: session.user.id, productId: id } },
      });
      purchased = !!purchase;
    }

    // Get seller profile
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: product.sellerId },
      select: { displayName: true, bio: true, avatar: true, country: true, isVerified: true, totalSales: true },
    });

    // Related products
    const related = await prisma.marketplaceProduct.findMany({
      where: { category: product.category, isPublished: true, isApproved: true, id: { not: id } },
      take: 4,
      select: { id: true, title: true, thumbnail: true, price: true, rating: true, sellerId: true },
    });

    return NextResponse.json({
      product: {
        ...product,
        languages: product.languages.split(","),
        tags: product.tags ? product.tags.split(",") : [],
      },
      sellerProfile,
      purchased,
      related,
    });
  } catch (error) {
    console.error("Product detail error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
