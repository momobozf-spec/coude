export interface Habit {
  id: string;
  emoji: string;
  arabic: string;
  dutch: string;
  free: boolean;
}

export const HABITS: Habit[] = [
  { id: "fajr", emoji: "\u{1F305}", arabic: "\u0635\u0644\u0627\u0629 \u0627\u0644\u0641\u062C\u0631", dutch: "Fajr gebed", free: true },
  { id: "dhuhr", emoji: "\u2600\uFE0F", arabic: "\u0635\u0644\u0627\u0629 \u0627\u0644\u0638\u0647\u0631", dutch: "Dhuhr gebed", free: true },
  { id: "asr", emoji: "\u{1F324}\uFE0F", arabic: "\u0635\u0644\u0627\u0629 \u0627\u0644\u0639\u0635\u0631", dutch: "Asr gebed", free: true },
  { id: "maghrib", emoji: "\u{1F307}", arabic: "\u0635\u0644\u0627\u0629 \u0627\u0644\u0645\u063A\u0631\u0628", dutch: "Maghrib gebed", free: true },
  { id: "isha", emoji: "\u{1F319}", arabic: "\u0635\u0644\u0627\u0629 \u0627\u0644\u0639\u0634\u0627\u0621", dutch: "Isha gebed", free: true },
  { id: "quran", emoji: "\u{1F4D6}", arabic: "\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0642\u0631\u0622\u0646", dutch: "Quran lezen", free: true },
  { id: "morning_dua", emoji: "\u{1F932}", arabic: "\u062F\u0639\u0627\u0621 \u0627\u0644\u0635\u0628\u0627\u062D", dutch: "Ochtend dua", free: true },
  { id: "bismillah", emoji: "\u2728", arabic: "\u0627\u0644\u0628\u0633\u0645\u0644\u0629", dutch: "Bismillah voor eten", free: true },
  { id: "helped", emoji: "\u{1F49A}", arabic: "\u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0622\u062E\u0631\u064A\u0646", dutch: "Iemand geholpen", free: true },
  { id: "alhamdulillah", emoji: "\u{1F64F}", arabic: "\u0627\u0644\u062D\u0645\u062F \u0644\u0644\u0647", dutch: "Alhamdulillah gezegd", free: true },
  { id: "wudu", emoji: "\u{1F4A7}", arabic: "\u0627\u0644\u0648\u0636\u0648\u0621", dutch: "Wudu voor gebed", free: false },
  { id: "islamic_story", emoji: "\u{1F4DA}", arabic: "\u0642\u0635\u0629 \u0625\u0633\u0644\u0627\u0645\u064A\u0629", dutch: "Islamitisch verhaal", free: false },
  { id: "new_dua", emoji: "\u{1F31F}", arabic: "\u062F\u0639\u0627\u0621 \u062C\u062F\u064A\u062F", dutch: "Nieuwe dua geleerd", free: false },
  { id: "sadaqah", emoji: "\u{1F91D}", arabic: "\u0627\u0644\u0635\u062F\u0642\u0629", dutch: "Sadaqah gegeven", free: false },
  { id: "fasted", emoji: "\u{1F95B}", arabic: "\u0627\u0644\u0635\u064A\u0627\u0645", dutch: "Gevast", free: false },
];

export const FREE_HABITS = HABITS.filter((h) => h.free);
export const PRO_HABITS = HABITS.filter((h) => !h.free);

export function getHabitsForPlan(plan: string): Habit[] {
  return plan === "pro" ? HABITS : FREE_HABITS;
}

export function countStars(habits: Record<string, boolean>): number {
  return Object.values(habits).filter(Boolean).length;
}

export const AVATAR_OPTIONS = [
  { slug: "star", emoji: "\u2B50" },
  { slug: "moon", emoji: "\u{1F319}" },
  { slug: "sun", emoji: "\u2600\uFE0F" },
  { slug: "heart", emoji: "\u{1F49A}" },
  { slug: "flower", emoji: "\u{1F33A}" },
  { slug: "butterfly", emoji: "\u{1F98B}" },
  { slug: "rainbow", emoji: "\u{1F308}" },
  { slug: "rocket", emoji: "\u{1F680}" },
];

export function getAvatarEmoji(slug: string): string {
  return AVATAR_OPTIONS.find((a) => a.slug === slug)?.emoji ?? "\u2B50";
}
