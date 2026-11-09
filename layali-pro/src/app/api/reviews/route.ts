import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Een beoordeling plaatsen. Alleen klanten met een betaalde bestelling van dit
 * product mogen beoordelen (geverifieerde aankoop), en een beoordeling is pas
 * zichtbaar nadat een beheerder ze goedkeurt (`approved`). Zo kunnen er geen
 * verzonnen of gekochte beoordelingen op de site komen (WER art. VI.100 en
 * VI.103, Omnibus-richtlijn).
 */
const reviewSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Je moet ingelogd zijn om een review te plaatsen" }, { status: 401 });
    }

    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Beoordeling moet een geheel getal tussen 1 en 5 zijn" }, { status: 400 });
    }
    const { productId, rating, comment } = parsed.data;
    const userId = session.user.id;

    const existingReview = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    if (existingReview) {
      return NextResponse.json({ error: "Je hebt dit product al beoordeeld" }, { status: 409 });
    }

    const purchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, paymentStatus: "PAID" } },
      select: { id: true },
    });
    if (!purchased) {
      return NextResponse.json(
        { error: "Alleen klanten die dit product gekocht hebben, kunnen het beoordelen" },
        { status: 403 },
      );
    }

    const review = await prisma.review.create({
      data: { userId, productId, rating, comment },
      select: { id: true, rating: true, comment: true, approved: true, createdAt: true },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("[reviews] fout:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het plaatsen van de review" }, { status: 500 });
  }
}
