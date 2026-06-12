export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getToday(): string {
  return formatDate(new Date());
}

export function getDayName(dateStr: string): string {
  const days = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
  const date = new Date(dateStr + "T12:00:00");
  return days[date.getDay()];
}

export function getLast7Days(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(formatDate(date));
  }
  return dates;
}

export function calculateStreak(
  logs: { date: string; stars: number }[],
  totalHabits: number
): number {
  if (logs.length === 0) return 0;

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < sortedLogs.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedDateStr = formatDate(expectedDate);

    const log = sortedLogs.find((l) => l.date === expectedDateStr);
    if (log && log.stars >= Math.ceil(totalHabits * 0.5)) {
      streak++;
    } else if (i === 0) {
      // Today might not be logged yet, check yesterday
      continue;
    } else {
      break;
    }
  }

  return streak;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
