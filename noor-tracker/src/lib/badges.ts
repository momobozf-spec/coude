export interface BadgeDefinition {
  id: string;
  title: string;
  emoji: string;
  description: string;
  minStars?: number;
  minStreak?: number;
  proOnly?: boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "first-stars",
    title: "Eerste sterren",
    emoji: "\u2B50",
    description: "De eerste 10 sterren zijn binnen.",
    minStars: 10,
  },
  {
    id: "steady-heart",
    title: "Steady hart",
    emoji: "\u{1F49A}",
    description: "Minstens 25 sterren verdiend.",
    minStars: 25,
  },
  {
    id: "streak-spark",
    title: "Streak Spark",
    emoji: "\u{1F525}",
    description: "Een streak van 3 dagen opgebouwd.",
    minStreak: 3,
  },
  {
    id: "quran-glow",
    title: "Quran Glow",
    emoji: "\u{1F4D6}",
    description: "Minstens 50 sterren verdiend.",
    minStars: 50,
    proOnly: true,
  },
  {
    id: "sadaqah-shine",
    title: "Sadaqah Shine",
    emoji: "\u{1F31F}",
    description: "Een streak van 7 dagen of meer.",
    minStreak: 7,
    proOnly: true,
  },
];

export function getEarnedBadges(totalStars: number, streak: number, plan: string) {
  return BADGES.filter((badge) => {
    if (badge.proOnly && plan !== "pro") {
      return false;
    }

    const starsOkay = badge.minStars ? totalStars >= badge.minStars : true;
    const streakOkay = badge.minStreak ? streak >= badge.minStreak : true;
    return starsOkay && streakOkay;
  });
}
