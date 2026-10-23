import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const sort = searchParams.get("sort");
    const limit = searchParams.get("limit");

    const where: Record<string, unknown> = { archived: false };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = { slug: category };
    }

    if (featured === "true") {
      where.featured = true;
    }

    const orderBy: Record<string, string> = {};
    switch (sort) {
      case "price_asc":
        orderBy.price = "asc";
        break;
      case "price_desc":
        orderBy.price = "desc";
        break;
      default:
        orderBy.createdAt = "desc";
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy,
      take: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
