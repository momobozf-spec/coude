import { prisma } from "./prisma";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 2000, 3500, 5000, 7500, 10000];
const LEVEL_NAMES = ["Seeker", "Student", "Learner", "Explorer", "Achiever", "Scholar", "Guardian", "Champion", "Legend", "Noor Master"];

export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
}

export function getXpForNextLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)] || 99999;
}

interface Trigger {
  type: "worksheet_completed" | "course_completed" | "ramadan_day" | "share" | "referral" | "login";
  theme?: string;
  ramadanDay?: number;
}

interface BadgeResult {
  newBadges: { id: string; name: string; tier: string; xpReward: number; iconEmoji: string }[];
  xpGained: number;
  levelUp: boolean;
  newLevel?: number;
  newLevelName?: string;
}

export async function checkAndAwardBadges(userId: string, trigger: Trigger): Promise<BadgeResult> {
  // Ensure progress record exists
  let progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId },
    });
  }

  // Update progress based on trigger
  const updates: Record<string, unknown> = { lastActivityDate: new Date() };
  if (trigger.type === "worksheet_completed") updates.worksheetsCompleted = { increment: 1 };
  if (trigger.type === "course_completed") updates.coursesCompleted = { increment: 1 };
  if (trigger.type === "ramadan_day") updates.ramadanDaysComplete = { increment: 1 };

  // Update streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = progress.lastActivityDate ? new Date(progress.lastActivityDate) : null;
  if (lastDate) {
    lastDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 1) {
      updates.currentStreak = progress.currentStreak + 1;
      updates.longestStreak = Math.max(progress.currentStreak + 1, progress.longestStreak);
    } else if (diffDays > 1) {
      updates.currentStreak = 1;
    }
    // diffDays === 0: same day, no streak change
  } else {
    updates.currentStreak = 1;
    updates.longestStreak = 1;
  }

  const updatedProgress = await prisma.userProgress.update({
    where: { userId },
    data: updates as never,
  });

  // Get un-earned badges
  const earnedIds = (await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  })).map(b => b.badgeId);

  const candidates = await prisma.badge.findMany({
    where: { isActive: true, id: { notIn: earnedIds } },
  });

  // Check each
  const newBadges: BadgeResult["newBadges"] = [];
  for (const badge of candidates) {
    const req = JSON.parse(badge.requirement || "{}");
    let earned = false;

    switch (req.type) {
      case "total_count":
        earned = updatedProgress.worksheetsCompleted >= (req.count || 0);
        break;
      case "theme_count":
        if (trigger.theme && trigger.theme.toLowerCase().includes(req.theme || "")) {
          const count = await prisma.generation.count({
            where: { userId, theme: { contains: req.theme || "" } },
          });
          earned = count >= (req.count || 0);
        }
        break;
      case "streak":
        earned = updatedProgress.currentStreak >= (req.days || 0) || updatedProgress.longestStreak >= (req.days || 0);
        break;
      case "ramadan_days":
        earned = updatedProgress.ramadanDaysComplete >= (req.count || 0);
        break;
      case "courses_completed":
        earned = updatedProgress.coursesCompleted >= (req.count || 0);
        break;
      case "referrals": {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCount: true } });
        earned = (user?.referralCount || 0) >= (req.count || 0);
        break;
      }
    }

    if (earned) {
      await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
      newBadges.push({
        id: badge.id,
        name: badge.name,
        tier: badge.tier,
        xpReward: badge.xpReward,
        iconEmoji: badge.iconEmoji,
      });

      // Auto-generate certificate for gold/platinum
      if (badge.tier === "gold" || badge.tier === "platinum") {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await prisma.certificate.create({
          data: {
            userId,
            type: "badge",
            title: `${badge.name} Certificate`,
            childName: user?.name || "Young Scholar",
            description: badge.description,
            badgeId: badge.id,
          },
        });
      }
    }
  }

  // Calculate XP
  const xpGained = newBadges.reduce((s, b) => s + b.xpReward, 0);
  const oldLevel = updatedProgress.level;
  const newTotalXp = updatedProgress.totalXp + xpGained;
  const newLevel = calculateLevel(newTotalXp);
  const levelUp = newLevel > oldLevel;

  if (xpGained > 0) {
    await prisma.userProgress.update({
      where: { userId },
      data: { totalXp: newTotalXp, level: newLevel },
    });
  }

  return {
    newBadges,
    xpGained,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
    newLevelName: levelUp ? getLevelName(newLevel) : undefined,
  };
}
