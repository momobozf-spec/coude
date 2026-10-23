import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        children: true,
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het ophalen van categorieën" },
      { status: 500 }
    );
  }
}

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

    const { name, description, image, parentId, sortOrder } =
      await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Naam is verplicht" },
        { status: 400 }
      );
    }

    let slug = slugify(name);
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });
    if (existingCategory) {
      slug = `${slug}-${Date.now()}`;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        image: image || null,
        parentId: parentId || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Category creation error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het aanmaken van de categorie" },
      { status: 500 }
    );
  }
}
