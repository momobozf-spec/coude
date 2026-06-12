import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Kortingscode is verplicht" },
        { status: 400 }
      );
    }

    const coupon = await prisma.couponCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Ongeldige kortingscode" },
        { status: 404 }
      );
    }

    if (!coupon.active) {
      return NextResponse.json(
        { error: "Deze kortingscode is niet meer actief" },
        { status: 400 }
      );
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Deze kortingscode is verlopen" },
        { status: 400 }
      );
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { error: "Deze kortingscode is al het maximale aantal keren gebruikt" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrder: coupon.minOrder,
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het valideren van de kortingscode" },
      { status: 500 }
    );
  }
}
