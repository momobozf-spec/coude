"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ALL_GAMES, getSavedProgress, TOTAL_LEVELS } from "@/lib/games/game-types";
import { getRandomFact } from "@/lib/games/game-facts";

const CATEGORIES = ["all", "educational", "puzzle", "creative"];
const CAT_LABELS: Record<string, string> = { all: "All Games", educational: "Educational", puzzle: "Puzzles", creative: "Creative" };

export default function GamesPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState("all");
  const [fact, setFact] = useState("");

  useEffect(() => { setFact(getRandomFact("memory")); }, []);

  const filtered = filter === "all" ? ALL_GAMES : ALL_GAMES.filter(g => g.category === filter);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.9)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="text-sm text-white/50">&larr; Dashboard</Link>
          <span className="font-bold" style={{ color: "#c9920a" }}>&#127918; Noor Games</span>
          <span className="text-xs text-white/30">{ALL_GAMES.length} games</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-white mb-1">Noor Games &#127918;</h1>
          <p className="text-white/40 text-sm">Learn Islamic knowledge while you play!</p>
        </div>

        {/* Fact */}
        <div className="rounded-xl p-3 mb-6 text-center" style={{ backgroundColor: "rgba(201,146,10,0.1)", border: "1px solid rgba(201,146,10,0.15)" }}>
          <p className="text-xs text-white/50">&#128161; {fact}</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap"
              style={filter === cat ? { backgroundColor: "#c9920a", color: "#fff" } : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(game => {
            const progress = getSavedProgress(game.slug);
            const completed = Object.keys(progress).length;
            const totalStars = Object.values(progress).reduce((s, p) => s + (p.stars || 0), 0);

            return (
              <Link key={game.slug} href={`/games/${game.slug}`}
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="aspect-[4/3] flex items-center justify-center text-4xl" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                  {game.icon}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="text-sm font-bold text-white truncate">{game.name}</h3>
                    {!game.free && <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c9920a", color: "#fff" }}>PRO</span>}
                  </div>
                  <p className="text-[10px] text-white/30 mb-2">{game.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/20">{"⭐".repeat(game.difficulty)}{"☆".repeat(3 - game.difficulty)}</span>
                    {completed > 0 && (
                      <span className="text-[10px]" style={{ color: "#1a6b4a" }}>{completed}/{TOTAL_LEVELS} · {totalStars}⭐</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <footer className="text-center py-6 text-xs text-white/20">Noor Games &mdash; Part of Noor Printables</footer>
    </div>
  );
}
