// Ramadan dates (approximate — based on astronomical calculations)
// Update yearly or use an Islamic calendar API for exact dates
const RAMADAN_DATES: Record<number, { start: string; end: string }> = {
  2025: { start: "2025-03-01", end: "2025-03-30" },
  2026: { start: "2026-02-18", end: "2026-03-19" },
  2027: { start: "2027-02-08", end: "2027-03-09" },
  2028: { start: "2028-01-28", end: "2028-02-26" },
};

export function getRamadanDates(year: number): { start: Date; end: Date } | null {
  const dates = RAMADAN_DATES[year];
  if (!dates) return null;
  return { start: new Date(dates.start), end: new Date(dates.end) };
}

export function getCurrentOrUpcomingRamadan(): { year: number; start: Date; end: Date } | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Check current year
  for (const year of [currentYear, currentYear + 1]) {
    const dates = getRamadanDates(year);
    if (!dates) continue;
    // If Ramadan hasn't ended yet (or is upcoming)
    if (now <= dates.end) {
      return { year, ...dates };
    }
  }

  return null;
}

export function getCurrentChallengeDay(startDate: Date): number | null {
  const now = new Date();
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (now < start) return null; // Not started yet

  const diffMs = now.getTime() - start.getTime();
  const dayNum = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;

  if (dayNum > 30) return null; // Challenge over
  return dayNum;
}

export function isDayUnlocked(dayNumber: number, startDate: Date): boolean {
  const now = new Date();
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const dayUnlockDate = new Date(start.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
  return now >= dayUnlockDate;
}

export function daysUntilRamadan(startDate: Date): number {
  const now = new Date();
  const diff = startDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function isEarlyBird(startDate: Date): boolean {
  return daysUntilRamadan(startDate) > 30;
}

// Badges
export const BADGES = {
  WEEK_1: { id: "week1", name: "First Week", emoji: "🌟", day: 7 },
  WEEK_2: { id: "week2", name: "Halfway!", emoji: "🏆", day: 14 },
  WEEK_3: { id: "week3", name: "Three Weeks", emoji: "💫", day: 21 },
  CHAMPION: { id: "champion", name: "Ramadan Champion", emoji: "🎉", day: 30 },
  STREAK_3: { id: "streak3", name: "3-Day Streak", emoji: "🔥", triggerStreak: 3 },
  STREAK_7: { id: "streak7", name: "7-Day Streak", emoji: "🔥🔥", triggerStreak: 7 },
  STREAK_14: { id: "streak14", name: "14-Day Streak", emoji: "🔥🔥🔥", triggerStreak: 14 },
  STREAK_30: { id: "streak30", name: "Perfect Ramadan", emoji: "⭐🔥⭐", triggerStreak: 30 },
  AMBASSADOR: { id: "ambassador", name: "Ramadan Ambassador", emoji: "📢", triggerShares: 3 },
} as const;

export function checkNewBadges(
  completedDays: number,
  streakDays: number,
  shareCount: number,
  existingBadges: string[]
): string[] {
  const newBadges: string[] = [];

  for (const badge of Object.values(BADGES)) {
    if (existingBadges.includes(badge.id)) continue;

    if ("day" in badge && completedDays >= badge.day) {
      newBadges.push(badge.id);
    }
    if ("triggerStreak" in badge && streakDays >= badge.triggerStreak) {
      newBadges.push(badge.id);
    }
    if ("triggerShares" in badge && shareCount >= badge.triggerShares) {
      newBadges.push(badge.id);
    }
  }

  return newBadges;
}
