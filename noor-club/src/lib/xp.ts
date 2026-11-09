export const LEVELS = [0, 100, 250, 500, 900, 1500, 2400, 3600] as const;

export function levelFor(xp: number) {
  const index = LEVELS.findIndex((threshold) => xp < threshold);
  const level = index === -1 ? LEVELS.length : index;
  const floor = LEVELS[level - 1] ?? 0;
  const ceil = LEVELS[level] ?? floor;
  return {
    level,
    progress: ceil > floor ? Math.min(1, (xp - floor) / (ceil - floor)) : 1,
    floor,
    ceil,
  };
}

/** XP: volledige beloning bij score >= 80, half daaronder. Herspelen levert 25%. */
export function xpForPlay(baseXp: number, score: number, isReplay: boolean) {
  const base = score >= 80 ? baseXp : Math.round(baseXp * 0.5);
  return isReplay ? Math.round(base * 0.25) : base;
}

/** Streak: +1 bij een nieuwe dag, reset bij een gat van meer dan 1 dag. */
export function nextStreak(current: number, lastPlay: Date | null, now = new Date()) {
  if (!lastPlay) return 1;
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(lastPlay).getTime()) / 86_400_000,
  );
  if (days === 0) return current;
  if (days === 1) return current + 1;
  return 1;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Score is altijd 0-100, ongeacht wat een engine aanlevert. */
export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Een spel telt als voltooid vanaf 60%. Daaronder mag het kind opnieuw. */
export const COMPLETION_THRESHOLD = 60;
