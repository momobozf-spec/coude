"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface ProgressData { totalXp: number; level: number; levelName: string; xpForNextLevel: number; currentStreak: number; badgeCount: number; totalBadges: number; }

export default function AchievementsWidget() {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    fetch("/api/achievements/progress")
      .then(r => r.json())
      .then(d => setProgress(d.progress))
      .catch(() => {});
  }, []);

  if (!progress) return null;

  const pct = Math.min(100, (progress.totalXp / progress.xpForNextLevel) * 100);

  return (
    <div className="card" style={{ borderColor: "#1a6b4a", borderWidth: 2 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-sm">&#127942; Achievements</h3>
        <Link href="/achievements" className="text-xs hover:underline" style={{ color: "#1a6b4a" }}>View All &rarr;</Link>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <div className="text-xl">&#128293;</div>
          <div className="text-xs font-bold">{progress.currentStreak}d</div>
          <div className="text-[10px] text-gray-400">streak</div>
        </div>
        <div className="text-center">
          <div className="text-xl">&#11088;</div>
          <div className="text-xs font-bold">Lvl {progress.level}</div>
          <div className="text-[10px] text-gray-400">{progress.levelName}</div>
        </div>
        <div className="text-center">
          <div className="text-xl">&#127775;</div>
          <div className="text-xs font-bold">{progress.badgeCount}/{progress.totalBadges}</div>
          <div className="text-[10px] text-gray-400">badges</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>{progress.totalXp} XP</span>
          <span>{progress.xpForNextLevel} XP</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#1a6b4a" }} />
        </div>
      </div>
    </div>
  );
}
