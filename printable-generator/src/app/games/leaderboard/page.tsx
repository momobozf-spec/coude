"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface LeaderEntry { rank: number; name: string; score: number; date: string; }

const GAMES = [
  { slug: "memory", name: "Memory" },
  { slug: "arabic", name: "Arabic" },
  { slug: "kaaba", name: "Kaaba" },
];

export default function LeaderboardPage() {
  const [game, setGame] = useState("memory");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/games/leaderboard?game=${game}&limit=20`)
      .then(r => r.json())
      .then(d => { setEntries(d.leaderboard || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [game]);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.9)" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/games" className="text-sm text-white/50">&larr; Games</Link>
          <span className="font-bold text-white">&#127942; Leaderboard</span>
          <div className="w-12" />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Game tabs */}
        <div className="flex gap-2 mb-6">
          {GAMES.map(g => (
            <button key={g.slug} onClick={() => setGame(g.slug)}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={game === g.slug ? { backgroundColor: "#c9920a", color: "#fff" } : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              {g.name}
            </button>
          ))}
        </div>

        {/* Entries */}
        {loading ? (
          <p className="text-center text-white/30 py-10">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">&#127942;</p>
            <p className="text-white/40">No scores yet. Be the first!</p>
            <Link href={`/games/${game}`} className="inline-block mt-4 px-6 py-2 rounded-lg text-sm font-bold" style={{ backgroundColor: "#1a6b4a", color: "#fff" }}>
              Play Now
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{
                backgroundColor: i < 3 ? "rgba(201,146,10,0.1)" : "rgba(255,255,255,0.04)",
                border: i < 3 ? "1px solid rgba(201,146,10,0.2)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                <span className="w-8 text-center font-bold" style={{ color: i === 0 ? "#c9920a" : i < 3 ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${e.rank}`}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{e.name}</p>
                </div>
                <span className="font-bold" style={{ color: "#c9920a" }}>{e.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
