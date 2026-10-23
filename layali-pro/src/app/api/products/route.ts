import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const sort = searchParams.get("sort") || "newest";
    const featured = searchParams.get("featured");
    const gender = searchParams.get("gender") || undefined;

    const where: Record<string, unknown> = {
      status: "ACTIVE",
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (category) {
      where.category = { slug: category };
    }

    if (featured === "true") {
      where.featured = true;
    }

    if (gender) {
      where.gender = gender;
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case "price-asc":
        orderBy = { price: "asc" };
        break;
      case "price-desc":
        orderBy = { price: "desc" };
        break;
      case "name-asc":
        orderBy = { name: "asc" };
        break;
      case "name-desc":
        orderBy = { name: "desc" };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: true,
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het ophalen van producten" },
      { status: 500 }
    );
  }
}
