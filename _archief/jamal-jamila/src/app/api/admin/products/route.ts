import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geautoriseerd" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Geen toegang — alleen beheerders" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      descriptionFr,
      descriptionAr,
      price,
      comparePrice,
      images,
      sizes,
      colors,
      materials,
      gender,
      stock,
      status,
      featured,
      badge,
      supplier,
      categoryId,
    } = body;

    if (!name || !description || !price || !categoryId) {
      return NextResponse.json(
        { error: "Naam, beschrijving, prijs en categorie zijn verplicht" },
        { status: 400 }
      );
    }

    // Generate unique slug
    let slug = slugify(name);
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });
    if (existingProduct) {
      slug = `${slug}-${Date.now()}`;
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        descriptionFr: descriptionFr || null,
        descriptionAr: descriptionAr || null,
        price,
        comparePrice: comparePrice || null,
        images: images || [],
        sizes: sizes || [],
        colors: colors || [],
        materials: materials || [],
        gender: gender || null,
        stock: stock ?? 0,
        status: status || "ACTIVE",
        featured: featured ?? false,
        badge: badge || null,
        supplier: supplier || null,
        categoryId,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het aanmaken van het product" },
      { status: 500 }
    );
  }
}
