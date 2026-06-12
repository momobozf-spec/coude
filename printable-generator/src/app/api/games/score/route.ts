import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SCORES: Record<string, number> = { memory: 1000, arabic: 2000, kaaba: 2000 };

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { gameSlug, score, metadata } = await req.json();
    if (!gameSlug || score === undefined) return NextResponse.json({ error: "gameSlug and score required" }, { status: 400 });

    // Anti-cheat
    if (score > (MAX_SCORES[gameSlug] || 5000)) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    // Save score
    await prisma.gameScore.create({
      data: { userId: session.user.id, gameSlug, score, metadata: JSON.stringify(metadata || {}) },
    });

    // Update stats
    let stats = await prisma.gameStats.findUnique({ where: { userId: session.user.id } });
    if (!stats) stats = await prisma.gameStats.create({ data: { userId: session.user.id } });

    const updates: Record<string, unknown> = { totalPlays: { increment: 1 } };
    if (gameSlug === "memory") { updates.memoryPlays = { increment: 1 }; if (score > stats.memoryBest) updates.memoryBest = score; }
    if (gameSlug === "arabic") { updates.arabicPlays = { increment: 1 }; if (score > stats.arabicBest) updates.arabicBest = score; }
    if (gameSlug === "kaaba") { updates.kaabaPlays = { increment: 1 }; if (score > stats.kaabaBest) updates.kaabaBest = score; }

    // XP: 1 XP per 10 score points
    const xp = Math.floor(score / 10);
    updates.totalGameXp = { increment: xp };

    await prisma.gameStats.update({ where: { userId: session.user.id }, data: updates as never });

    const newBest = (gameSlug === "memory" && score > stats.memoryBest) ||
                    (gameSlug === "arabic" && score > stats.arabicBest) ||
                    (gameSlug === "kaaba" && score > stats.kaabaBest);

    return NextResponse.json({ saved: true, newBest, xpGained: xp });
  } catch (error) {
    console.error("Game score error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
