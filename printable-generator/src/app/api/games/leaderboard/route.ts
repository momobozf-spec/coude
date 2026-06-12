import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game") || "memory";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    const scores = await prisma.gameScore.findMany({
      where: { gameSlug: game },
      orderBy: { score: "desc" },
      take: limit,
      distinct: ["userId"],
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({
      leaderboard: scores.map((s, i) => ({
        rank: i + 1,
        name: s.user.name ? `${s.user.name.split(" ")[0]} ${s.user.name.split(" ")[1]?.[0] || ""}.` : "Player",
        score: s.score,
        date: s.playedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
