import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n-json";
import { hashed, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything we hold about this account, as JSON.
 *
 * Deliberately excluded: `passwordHash` (exporting it would turn one leaked
 * download into an offline cracking target) and the Stripe identifiers (they
 * are our billing plumbing, not the customer's personal data, and they are a
 * lever for social-engineering support).
 */
export async function GET() {
  const log = logger("account.export");

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      subStatus: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      emailVerifiedAt: true,
      withdrawalWaivedAt: true,
      createdAt: true,
      children: {
        select: {
          id: true,
          name: true,
          avatar: true,
          ageBand: true,
          xp: true,
          streak: true,
          lastPlay: true,
          createdAt: true,
          plays: {
            select: {
              id: true,
              score: true,
              completed: true,
              durationSec: true,
              createdAt: true,
              game: { select: { slug: true, engine: true, titles: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          badges: {
            select: {
              earnedAt: true,
              badge: { select: { slug: true, titles: true } },
            },
            orderBy: { earnedAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      language: user.locale,
      subscriptionStatus: user.subStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      trialEndsAt: user.trialEndsAt,
      emailVerifiedAt: user.emailVerifiedAt,
      withdrawalRightWaivedAt: user.withdrawalWaivedAt,
      createdAt: user.createdAt,
    },
    children: user.children.map((child) => ({
      name: child.name,
      avatar: child.avatar,
      ageBand: child.ageBand,
      xp: child.xp,
      streak: child.streak,
      lastPlay: child.lastPlay,
      createdAt: child.createdAt,
      plays: child.plays.map((play) => ({
        game: play.game.slug,
        engine: play.game.engine,
        title: localize(play.game.titles, user.locale, play.game.slug),
        score: play.score,
        completed: play.completed,
        durationSeconds: play.durationSec,
        playedAt: play.createdAt,
      })),
      badges: child.badges.map((row) => ({
        badge: row.badge.slug,
        title: localize(row.badge.titles, user.locale, row.badge.slug),
        earnedAt: row.earnedAt,
      })),
    })),
  };

  log.info("exported", {
    user: hashed(user.id),
    children: payload.children.length,
    plays: payload.children.reduce((sum, child) => sum + child.plays.length, 0),
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="noor-club-gegevens.json"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
