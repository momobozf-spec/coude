import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return user?.role === "ADMIN";
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      price,
      comparePrice,
      images,
      stock,
      categoryId,
      featured,
      archived,
    } = body;

    if (!name || !slug || !description || !price || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A product with this slug already exists" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price,
        comparePrice: comparePrice || null,
        images: images || [],
        stock: stock || 0,
        categoryId,
        featured: featured || false,
        archived: archived || false,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
