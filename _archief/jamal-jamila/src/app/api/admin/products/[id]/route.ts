import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product niet gevonden" },
        { status: 404 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: parseFloat(body.price),
        comparePrice: body.comparePrice ? parseFloat(body.comparePrice) : null,
        images: body.images ?? [],
        sizes: body.sizes ?? [],
        colors: body.colors ?? [],
        stock: parseInt(body.stock) || 0,
        categoryId: body.categoryId,
        featured: !!body.featured,
        badge: body.badge || null,
        status: body.status || "ACTIVE",
      },
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het bijwerken van het product" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product niet gevonden" },
        { status: 404 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: body,
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het bijwerken van het product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product niet gevonden" },
        { status: 404 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product deletion error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het verwijderen van het product" },
      { status: 500 }
    );
  }
}
