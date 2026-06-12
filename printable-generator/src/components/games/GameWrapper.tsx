"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Difficulty, LevelResult, TOTAL_LEVELS, getLevelDifficulty, getSavedProgress, saveLevelProgress, isLevelUnlocked, XP_PER_DIFFICULTY } from "@/lib/games/game-types";

interface Props {
  gameSlug: string;
  gameName: string;
  children: (props: { level: number; difficulty: Difficulty; onComplete: (result: LevelResult) => void }) => React.ReactNode;
}

const DIFF_TABS: { key: Difficulty; label: string; levels: number[] }[] = [
  { key: "easy", label: "Easy", levels: [1, 2, 3, 4, 5] },
  { key: "medium", label: "Medium", levels: [6, 7, 8, 9, 10] },
  { key: "hard", label: "Hard", levels: [11, 12, 13, 14, 15] },
];

export default function GameWrapper({ gameSlug, gameName, children }: Props) {
  const [view, setView] = useState<"select" | "playing" | "complete">("select");
  const [diffTab, setDiffTab] = useState<Difficulty>("easy");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [lastResult, setLastResult] = useState<LevelResult | null>(null);

  const progress = getSavedProgress(gameSlug);

  const startLevel = useCallback((level: number) => {
    setCurrentLevel(level);
    setView("playing");
    setLastResult(null);
  }, []);

  const handleComplete = useCallback(async (result: LevelResult) => {
    saveLevelProgress(gameSlug, result.level, result.stars, result.score);
    setLastResult(result);
    setView("complete");

    // Submit score to API
    try {
      await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameSlug,
          score: result.score,
          metadata: { level: result.level, difficulty: result.difficulty, stars: result.stars, timeSeconds: result.timeSeconds, xpEarned: result.xpEarned },
        }),
      });
      // Trigger badge check
      await fetch("/api/achievements/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "worksheet_completed", theme: `game_${gameSlug}` }),
      });
    } catch { /* silent */ }
  }, [gameSlug]);

  // ── Level Select View ──
  if (view === "select") {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
        <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.9)" }}>
          <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
            <Link href="/games" className="text-sm text-white/50">&larr; Games</Link>
            <span className="font-bold text-white">{gameName}</span>
            <div className="w-12" />
          </div>
        </nav>

        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Difficulty tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            {DIFF_TABS.map(tab => (
              <button key={tab.key} onClick={() => setDiffTab(tab.key)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={diffTab === tab.key ? { backgroundColor: tab.key === "easy" ? "#1a6b4a" : tab.key === "medium" ? "#c9920a" : "#dc2626", color: "#fff" } : { color: "rgba(255,255,255,0.4)" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Level grid */}
          <div className="grid grid-cols-5 gap-3">
            {DIFF_TABS.find(t => t.key === diffTab)!.levels.map(level => {
              const unlocked = isLevelUnlocked(gameSlug, level);
              const saved = progress[level];
              const stars = saved?.stars || 0;

              return (
                <button key={level} onClick={() => unlocked && startLevel(level)} disabled={!unlocked}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center transition-all"
                  style={{
                    backgroundColor: unlocked ? (stars >= 1 ? "rgba(26,107,74,0.3)" : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.03)",
                    border: stars === 3 ? "2px solid #c9920a" : stars >= 1 ? "1px solid rgba(26,107,74,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    opacity: unlocked ? 1 : 0.35,
                    cursor: unlocked ? "pointer" : "not-allowed",
                  }}>
                  <span className="text-lg font-bold text-white">{unlocked ? level : "🔒"}</span>
                  {stars > 0 && (
                    <span className="text-xs mt-0.5" style={{ color: "#c9920a" }}>
                      {"⭐".repeat(stars)}{"☆".repeat(3 - stars)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Stats summary */}
          <div className="mt-6 rounded-xl p-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
            <p className="text-xs text-white/40">
              {Object.keys(progress).length}/{TOTAL_LEVELS} levels completed &middot;
              {Object.values(progress).reduce((s, p) => s + (p.stars || 0), 0)}/{TOTAL_LEVELS * 3} stars
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Level Complete View ──
  if (view === "complete" && lastResult) {
    const hasNext = lastResult.level < TOTAL_LEVELS;
    const nextUnlocked = hasNext && isLevelUnlocked(gameSlug, lastResult.level + 1);

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
        <div className="text-center max-w-sm w-full rounded-2xl p-8" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-4xl mb-3">{lastResult.stars === 3 ? "🌟" : lastResult.stars === 2 ? "⭐" : "✅"}</div>
          <h2 className="text-xl font-bold text-white mb-1">
            {lastResult.stars === 3 ? "Perfect!" : lastResult.stars === 2 ? "Great Job!" : "Level Complete!"}
          </h2>
          <p className="text-2xl font-extrabold mb-2" style={{ color: "#c9920a" }}>
            {"⭐".repeat(lastResult.stars)}{"☆".repeat(3 - lastResult.stars)}
          </p>
          <p className="text-sm text-white/50 mb-1">Score: {lastResult.score}</p>
          <p className="text-sm mb-4" style={{ color: "#1a6b4a" }}>+{lastResult.xpEarned} XP</p>

          <div className="flex gap-2">
            <button onClick={() => startLevel(lastResult.level)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
              Retry
            </button>
            {nextUnlocked ? (
              <button onClick={() => startLevel(lastResult.level + 1)} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: "#1a6b4a" }}>
                Next Level &rarr;
              </button>
            ) : (
              <button onClick={() => setView("select")} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: "#1a6b4a" }}>
                Level Select
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Playing View ──
  const difficulty = getLevelDifficulty(currentLevel);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0f172a" }}>
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <button onClick={() => setView("select")} className="text-xs text-white/40">&larr; Levels</button>
        <span className="text-xs text-white/60">Level {currentLevel} &middot; {difficulty}</span>
        <div className="w-12" />
      </div>

      <div className="flex-1">
        {children({ level: currentLevel, difficulty, onComplete: handleComplete })}
      </div>
    </div>
  );
}
