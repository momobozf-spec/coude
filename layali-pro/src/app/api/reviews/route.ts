import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Je moet ingelogd zijn om een review te plaatsen" },
        { status: 401 }
      );
    }

    const { productId, rating, comment } = await request.json();

    if (!productId || !rating) {
      return NextResponse.json(
        { error: "Product ID en beoordeling zijn verplicht" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Beoordeling moet tussen 1 en 5 liggen" },
        { status: 400 }
      );
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "Je hebt dit product al beoordeeld" },
        { status: 409 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product niet gevonden" },
        { status: 404 }
      );
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        productId,
        rating,
        comment: comment || null,
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Review creation error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het plaatsen van de review" },
      { status: 500 }
    );
  }
}
