"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { packAccess } from "@/lib/entitlement";
import { firstIssueKey, recordPlaySchema } from "@/lib/validators";
import { localize } from "@/lib/i18n-json";
import { COMPLETION_THRESHOLD, levelFor, nextStreak, xpForPlay } from "@/lib/xp";
import { describeError, hashed, logger } from "@/lib/logger";
import { track } from "@/lib/track";

/**
 * Records that a child opened a game, for the funnel only.
 *
 * Separate from `recordPlay` because the drop-off between "started" and
 * "completed" is the number that tells you whether a game is too hard — and you
 * cannot see it if you only log finished games.
 */
export async function noteGameStarted(input: {
  childId: string;
  gameSlug: string;
}): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;

    const child = await db.child.findFirst({
      where: { id: input.childId, userId: session.user.id },
      select: { id: true },
    });
    if (!child) return;

    track("game_started", {
      userId: session.user.id,
      childId: child.id,
      gameSlug: input.gameSlug,
    });
  } catch {
    // Analytics must never break a game.
  }
}

export type RecordPlayResult = {
  error?: string;
  xpGained?: number;
  totalXp?: number;
  level?: number;
  levelUp?: boolean;
  streak?: number;
  packCompleted?: boolean;
  newBadge?: { slug: string; title: string; iconUrl: string };
};

/**
 * The one write path for gameplay.
 *
 * Everything the client sends is untrusted, including the score: the child id is
 * re-checked against the session, the game is looked up by slug on the server,
 * and the pack entitlement is evaluated again here. A client that POSTs a
 * perfect score for a locked pack gets `errors.packLocked`, not XP.
 */
export async function recordPlay(input: unknown): Promise<RecordPlayResult> {
  const parsed = recordPlaySchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  const { childId, gameSlug, score, durationSec, locale } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return { error: "errors.unauthorized" };

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, subStatus: true, currentPeriodEnd: true },
    });
    if (!user) return { error: "errors.unauthorized" };

    const child = await db.child.findFirst({
      where: { id: childId, userId: user.id },
      select: { id: true, xp: true, streak: true, lastPlay: true },
    });
    if (!child) return { error: "errors.childNotFound" };

    const game = await db.game.findUnique({
      where: { slug: gameSlug },
      select: {
        id: true,
        xp: true,
        pack: {
          select: {
            id: true,
            slug: true,
            isFree: true,
            releaseAt: true,
            games: { select: { id: true } },
            badges: { select: { id: true, slug: true, titles: true, iconUrl: true } },
          },
        },
      },
    });
    if (!game) return { error: "errors.gameNotFound" };

    const isSubscribed =
      (user.subStatus === "ACTIVE" || user.subStatus === "TRIALING") &&
      (!user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now());

    const access = packAccess({ isSubscribed }, game.pack);
    if (access === "paywall") return { error: "errors.packLocked" };
    if (access === "unreleased") return { error: "errors.packUnreleased" };

    const previousPlay = await db.gamePlay.findFirst({
      where: { childId: child.id, gameId: game.id },
      select: { id: true },
    });

    const isReplay = previousPlay !== null;
    const xpGained = xpForPlay(game.xp, score, isReplay);
    const completed = score >= COMPLETION_THRESHOLD;
    const levelBefore = levelFor(child.xp).level;
    const streak = nextStreak(child.streak, child.lastPlay);

    const outcome = await db.$transaction(async (tx) => {
      await tx.gamePlay.create({
        data: {
          childId: child.id,
          gameId: game.id,
          score,
          durationSec,
          completed,
        },
      });

      const updatedChild = await tx.child.update({
        where: { id: child.id },
        data: {
          xp: { increment: xpGained },
          streak,
          lastPlay: new Date(),
        },
        select: { xp: true, streak: true },
      });

      const packGameIds = game.pack.games.map((entry) => entry.id);
      const finishedGames = await tx.gamePlay.findMany({
        where: {
          childId: child.id,
          gameId: { in: packGameIds },
          completed: true,
        },
        select: { gameId: true },
        distinct: ["gameId"],
      });

      const packCompleted =
        packGameIds.length > 0 && finishedGames.length >= packGameIds.length;

      let newBadge: RecordPlayResult["newBadge"];

      if (packCompleted) {
        for (const badge of game.pack.badges) {
          const already = await tx.childBadge.findUnique({
            where: { childId_badgeId: { childId: child.id, badgeId: badge.id } },
            select: { id: true },
          });

          // Upsert keeps this idempotent: replaying a finished pack re-runs the
          // loop but only the very first award reports a `newBadge`.
          await tx.childBadge.upsert({
            where: { childId_badgeId: { childId: child.id, badgeId: badge.id } },
            create: { childId: child.id, badgeId: badge.id },
            update: {},
          });

          if (!already) {
            newBadge = {
              slug: badge.slug,
              title: localize(badge.titles, locale, badge.slug),
              iconUrl: badge.iconUrl,
            };
          }
        }
      }

      return { updatedChild, packCompleted, newBadge };
    });

    const levelAfter = levelFor(outcome.updatedChild.xp).level;

    track("game_completed", {
      userId: user.id,
      childId: child.id,
      gameSlug,
      packSlug: game.pack.slug,
      score,
      durationSec,
    });

    if (outcome.packCompleted) {
      track("pack_completed", {
        userId: user.id,
        childId: child.id,
        packSlug: game.pack.slug,
      });
    }

    revalidatePath(`/${locale}/kind/${child.id}`);
    revalidatePath(`/${locale}/pakket/${game.pack.slug}`);
    revalidatePath(`/${locale}/paspoort/${child.id}`);
    revalidatePath(`/${locale}/ouder`);
    revalidatePath(`/${locale}/kinderen`);

    return {
      xpGained,
      totalXp: outcome.updatedChild.xp,
      level: levelAfter,
      levelUp: levelAfter > levelBefore,
      streak: outcome.updatedChild.streak,
      packCompleted: outcome.packCompleted,
      ...(outcome.newBadge ? { newBadge: outcome.newBadge } : {}),
    };
  } catch (error) {
    logger("play.record").error("recordPlay failed", {
      game: gameSlug,
      child: hashed(childId),
      ...describeError(error),
    });
    return { error: "errors.generic" };
  }
}
