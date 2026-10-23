import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const { status } = await request.json();

    const validStatuses = [
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Ongeldige status. Geldige waarden: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Bestelling niet gevonden" },
        { status: 404 }
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: { product: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order status update error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het bijwerken van de bestelling" },
      { status: 500 }
    );
  }
}
