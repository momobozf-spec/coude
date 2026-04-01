import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const age = url.searchParams.get("age");
    const lang = url.searchParams.get("language");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");
    const sort = url.searchParams.get("sort") || "newest";
    const search = url.searchParams.get("q");
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 20;

    const where: Record<string, unknown> = {
      isApproved: true,
      isPublished: true,
    };

    if (category) where.category = category;
    if (age) where.ageRange = age;
    if (lang) where.languages = { contains: lang };
    if (search) where.title = { contains: search };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) (where.price as Record<string, unknown>).gte = parseFloat(minPrice);
      if (maxPrice) (where.price as Record<string, unknown>).lte = parseFloat(maxPrice);
    }

    const orderBy: Record<string, string> = sort === "popular" ? { downloads: "desc" } : sort === "rating" ? { rating: "desc" } : sort === "price_low" ? { price: "asc" } : sort === "price_high" ? { price: "desc" } : { createdAt: "desc" };

    const [products, total] = await Promise.all([
      prisma.marketplaceProduct.findMany({
        where: where as never,
        orderBy: orderBy as never,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          seller: { select: { name: true, image: true } },
        },
      }),
      prisma.marketplaceProduct.count({ where: where as never }),
    ]);

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        languages: p.languages.split(","),
        tags: p.tags ? p.tags.split(",") : [],
        sellerName: p.seller.name,
        sellerAvatar: p.seller.image,
      })),
      total,
      pages: Math.ceil(total / perPage),
      page,
    });
  } catch (error) {
    console.error("Products list error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
