"use client";

import Link from "next/link";
import { useState, useEffect, use } from "react";

interface DayData {
  id: string; dayNumber: number; title: string; titleAr: string; theme: string;
  activityType: string; duaOfDay: string | null; hadithOfDay: string | null;
  unlocked: boolean; completed: boolean; isToday: boolean;
}

export default function ChallengeDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = use(params);
  const dayNum = parseInt(day);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [badge, setBadge] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/ramadan/dashboard").then(r => r.json()).then(d => {
      const found = d.days?.find((dd: DayData) => dd.dayNumber === dayNum);
      if (found) {
        setDayData(found);
        setCompleted(found.completed);
      }
    });
  }, [dayNum]);

  async function handleComplete() {
    if (!dayData) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/ramadan/complete-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayId: dayData.id }),
      });
      const data = await res.json();
      setCompleted(true);
      setStreak(data.streakDays || 0);
      if (data.newBadges?.length > 0) setBadge(data.newBadges);
    } catch { /* */ }
    setCompleting(false);
  }

  if (!dayData) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f172a", color: "#fff" }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: "#0f172a", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.95)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/ramadan-challenge/dashboard" className="text-sm text-white/50 hover:text-white">&larr; Calendar</Link>
          <span className="font-bold text-sm" style={{ color: "#f5c842" }}>Day {dayNum}/30</span>
          {dayNum < 30 && (
            <Link href={`/ramadan-challenge/day/${dayNum + 1}`} className="text-sm text-white/50 hover:text-white">Day {dayNum + 1} &rarr;</Link>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
            DAY {dayNum} — {dayData.activityType.toUpperCase()}
          </span>
          <h1 className="text-2xl font-extrabold mb-1">{dayData.title}</h1>
          <p className="text-lg" style={{ fontFamily: "'Amiri', serif", color: "rgba(255,255,255,0.5)" }}>{dayData.titleAr}</p>
        </div>

        {/* Dua of the day */}
        {dayData.duaOfDay && (
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)" }}>
            <p className="text-xs text-white/40 mb-1">🤲 Dua of the Day</p>
            <p className="font-medium" style={{ color: "#f5c842" }}>{dayData.duaOfDay}</p>
          </div>
        )}

        {/* Hadith */}
        {dayData.hadithOfDay && (
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: "rgba(26,107,74,0.1)", border: "1px solid rgba(26,107,74,0.2)" }}>
            <p className="text-xs text-white/40 mb-1">📖 Hadith</p>
            <p className="text-sm text-white/80">{dayData.hadithOfDay}</p>
          </div>
        )}

        {/* Activity placeholder */}
        <div className="rounded-xl p-8 text-center mb-6" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-4xl mb-3">
            {dayData.activityType === "coloring" && "🎨"}
            {dayData.activityType === "maze" && "🔍"}
            {dayData.activityType === "wordsearch" && "🔤"}
            {dayData.activityType === "tracing" && "✏️"}
            {dayData.activityType === "special" && "🌟"}
          </div>
          <p className="font-bold mb-1">{dayData.theme}</p>
          <p className="text-sm text-white/40 mb-4">Theme: {dayData.theme}</p>

          <div className="flex gap-3 justify-center">
            <Link href={`/dashboard`} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#1a6b4a" }}>
              &#128438; Generate &amp; Print
            </Link>
            <Link href="/color" className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              &#127912; Color Digitally
            </Link>
          </div>
        </div>

        {/* Complete button */}
        {!completed ? (
          <button onClick={handleComplete} disabled={completing}
            className="w-full py-3.5 rounded-xl font-bold text-lg transition-all disabled:opacity-50"
            style={{ backgroundColor: "#1a6b4a" }}>
            {completing ? "Saving..." : "✓ Mark Day Complete"}
          </button>
        ) : (
          <div className="text-center">
            <div className="py-4 rounded-xl mb-3" style={{ backgroundColor: "rgba(26,107,74,0.2)", border: "1px solid rgba(26,107,74,0.3)" }}>
              <p className="text-lg font-bold" style={{ color: "#1a6b4a" }}>✓ Day {dayNum} Complete!</p>
              {streak > 0 && <p className="text-sm text-white/60">🔥 {streak} day streak</p>}
            </div>

            {/* Badge earned popup */}
            {badge.length > 0 && (
              <div className="py-4 rounded-xl mb-3" style={{ backgroundColor: "rgba(245,200,66,0.15)", border: "1px solid rgba(245,200,66,0.3)" }}>
                <p className="text-lg mb-1">🏆 New Badge Earned!</p>
                {badge.map(b => {
                  const info = Object.values({ ...({ _: { id: b, name: b, emoji: "🏆" } }) })[0];
                  return <p key={b} className="font-bold" style={{ color: "#f5c842" }}>{info.emoji} {info.name}</p>;
                })}
              </div>
            )}

            <Link href="/ramadan-challenge/dashboard" className="text-sm hover:underline" style={{ color: "#f5c842" }}>
              Back to Calendar &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
