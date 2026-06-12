export type Difficulty = "easy" | "medium" | "hard";

export interface LevelResult {
  level: number;
  difficulty: Difficulty;
  score: number;
  stars: 1 | 2 | 3;
  timeSeconds: number;
  xpEarned: number;
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLevelComplete: (result: LevelResult) => void;
  onGameOver: (score: number, meta: Record<string, unknown>) => void;
}

export interface GameEngine {
  init: () => void;
  destroy: () => void;
  handleClick?: (e: MouseEvent | React.MouseEvent) => void;
  handleTouch?: (e: TouchEvent | React.TouchEvent) => void;
}

export const XP_PER_DIFFICULTY: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50 };
export const LEVELS_PER_DIFFICULTY = 5;
export const TOTAL_LEVELS = 15;

export function calculateStars(score: number, maxScore: number): 1 | 2 | 3 {
  const pct = score / maxScore;
  if (pct >= 0.9) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

export function getLevelDifficulty(level: number): Difficulty {
  if (level <= 5) return "easy";
  if (level <= 10) return "medium";
  return "hard";
}

// Saved progress in localStorage
export function getSavedProgress(gameSlug: string): Record<number, { stars: number; score: number }> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(`noor_game_${gameSlug}`) || "{}");
  } catch { return {}; }
}

export function saveLevelProgress(gameSlug: string, level: number, stars: number, score: number) {
  if (typeof localStorage === "undefined") return;
  const progress = getSavedProgress(gameSlug);
  const existing = progress[level];
  if (!existing || stars > existing.stars || score > existing.score) {
    progress[level] = { stars: Math.max(stars, existing?.stars || 0), score: Math.max(score, existing?.score || 0) };
    localStorage.setItem(`noor_game_${gameSlug}`, JSON.stringify(progress));
  }
}

export function isLevelUnlocked(gameSlug: string, level: number): boolean {
  if (level === 1) return true;
  const progress = getSavedProgress(gameSlug);
  return (progress[level - 1]?.stars || 0) >= 1;
}

export interface GameInfo {
  slug: string;
  name: string;
  nameAr: string;
  description: string;
  category: "educational" | "puzzle" | "creative";
  icon: string;
  difficulty: number; // 1-3
  free: boolean;
}

export const ALL_GAMES: GameInfo[] = [
  { slug: "memory", name: "Moskee Memory", nameAr: "لعبة الذاكرة", description: "Match Islamic symbol pairs", category: "educational", icon: "🕌", difficulty: 1, free: true },
  { slug: "arabic", name: "Arabische Letter Vangen", nameAr: "امسك الحروف", description: "Catch falling Arabic letters", category: "educational", icon: "أ", difficulty: 2, free: true },
  { slug: "kaaba", name: "Bouw de Kaaba", nameAr: "ابنِ الكعبة", description: "Stack blocks to build the Kaaba", category: "puzzle", icon: "🕋", difficulty: 3, free: true },
  { slug: "arabic-letter-match", name: "Arabic Letter Match", nameAr: "مطابقة الحروف", description: "Match Arabic letters to their names", category: "educational", icon: "🔤", difficulty: 1, free: true },
  { slug: "99-namen-quiz", name: "99 Namen Quiz", nameAr: "أسماء الله الحسنى", description: "Quiz about the 99 Names of Allah", category: "educational", icon: "📖", difficulty: 2, free: true },
  { slug: "woorden-zoeker-race", name: "Woorden Zoeker Race", nameAr: "سباق البحث", description: "Find Islamic words in a grid", category: "puzzle", icon: "🔍", difficulty: 2, free: false },
  { slug: "labyrint-runner", name: "Labyrint Runner", nameAr: "المتاهة", description: "Navigate mazes to reach the mosque", category: "puzzle", icon: "🏃", difficulty: 2, free: false },
  { slug: "kleur-bij-getal", name: "Kleur bij Getal", nameAr: "لوّن بالأرقام", description: "Paint Islamic illustrations by number", category: "creative", icon: "🎨", difficulty: 1, free: false },
  { slug: "sudoku-islami", name: "Sudoku Islami", nameAr: "سودوكو إسلامي", description: "Sudoku with Arabic numerals", category: "puzzle", icon: "🔢", difficulty: 3, free: false },
  { slug: "patroon-puzzel", name: "Patroon Puzzel", nameAr: "لغز النمط", description: "Sliding puzzle with Islamic patterns", category: "puzzle", icon: "🧩", difficulty: 3, free: false },
  { slug: "patroon-maker", name: "Patroon Maker", nameAr: "صانع الأنماط", description: "Create Islamic geometric patterns", category: "creative", icon: "✨", difficulty: 2, free: false },
  { slug: "henna-designer", name: "Henna Designer", nameAr: "مصمم الحناء", description: "Decorate hands with henna patterns", category: "creative", icon: "🖐️", difficulty: 2, free: false },
];
