import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePdf } from "@/lib/pdf";
import { generateSchema } from "@/lib/validations";
import { getGenerationLimit } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { activityType, theme } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, generationsCount: true, bonusGenerations: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const limit = getGenerationLimit(user.plan, user.bonusGenerations);

    if (user.generationsCount >= limit) {
      return NextResponse.json(
        {
          error: "Generation limit reached. Upgrade your plan or invite friends for bonus sheets.",
          limitReached: true,
          used: user.generationsCount,
          limit: limit === Infinity ? "unlimited" : limit,
        },
        { status: 403 }
      );
    }

    const pdfBuffer = await generatePdf({ activityType, theme });

    await prisma.$transaction([
      prisma.generation.create({
        data: { userId: session.user.id, activityType, theme },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { generationsCount: { increment: 1 } },
      }),
    ]);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="noor-${activityType}-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
