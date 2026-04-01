import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const products = await prisma.marketplaceProduct.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { purchases: true } } },
    });

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        purchaseCount: p._count.purchases,
        languages: p.languages.split(","),
        tags: p.tags ? p.tags.split(",") : [],
      })),
    });
  } catch (error) {
    console.error("Seller products error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Must be a seller
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!seller) return NextResponse.json({ error: "Not a seller. Register first." }, { status: 403 });

    const body = await req.json();
    const { title, description, category, ageRange, languages, tags, price, pageCount, fileUrl, previewUrl, thumbnail } = body;

    if (!title || !description || !category || price === undefined) {
      return NextResponse.json({ error: "title, description, category, price required" }, { status: 400 });
    }

    if (price > 0 && price < 1.99) {
      return NextResponse.json({ error: "Minimum price is $1.99 (or $0 for free)" }, { status: 400 });
    }

    const product = await prisma.marketplaceProduct.create({
      data: {
        sellerId: session.user.id,
        title,
        description,
        category,
        ageRange: ageRange || "4-8",
        languages: Array.isArray(languages) ? languages.join(",") : languages || "EN",
        tags: Array.isArray(tags) ? tags.join(",") : tags || "",
        price: parseFloat(price) || 0,
        pageCount: pageCount || 1,
        fileUrl: fileUrl || "",
        previewUrl: previewUrl || "",
        thumbnail: thumbnail || "",
        isPublished: false,
        isApproved: false,
      },
    });

    return NextResponse.json({ success: true, productId: product.id });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
