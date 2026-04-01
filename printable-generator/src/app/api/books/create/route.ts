import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { title, childName, childAge, coverStyle, coverColor, dedicationText, language, variant, worksheetIds } = await req.json();
    if (!title || !childName || !worksheetIds?.length) {
      return NextResponse.json({ error: "title, childName, worksheetIds required" }, { status: 400 });
    }

    if (worksheetIds.length < 10 || worksheetIds.length > 30) {
      return NextResponse.json({ error: "Book must have 10-30 pages" }, { status: 400 });
    }

    const book = await prisma.coloringBook.create({
      data: {
        userId: session.user.id,
        title,
        childName,
        childAge: childAge || null,
        coverStyle: coverStyle || "classic",
        coverColor: coverColor || "#1a6b4a",
        dedicationText: dedicationText || null,
        language: language || "EN",
        variant: variant || "softcover_20",
        pageCount: worksheetIds.length,
        worksheetIds: worksheetIds.join(","),
      },
    });

    return NextResponse.json({ success: true, bookId: book.id });
  } catch (error) {
    console.error("Book create error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
