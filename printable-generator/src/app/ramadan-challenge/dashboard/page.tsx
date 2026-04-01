"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { BADGES } from "@/lib/ramadan";

interface DayData {
  id: string; dayNumber: number; title: string; titleAr: string; theme: string;
  activityType: string; duaOfDay: string | null; hadithOfDay: string | null;
  unlocked: boolean; completed: boolean; isToday: boolean;
}

interface EnrollmentData {
  id: string; childName: string; childAge: number;
  badgesEarned: string[]; streakDays: number; shareCount: number;
}

export default function RamadanDashboard() {
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [days, setDays] = useState<DayData[]>([]);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/ramadan/dashboard");
      if (!res.ok) {
        if (res.status === 404) { window.location.href = "/ramadan-challenge"; return; }
        return;
      }
      const data = await res.json();
      setEnrollment(data.enrollment);
      setDays(data.days);
      setCurrentDay(data.currentDay);
      setTotalCompleted(data.totalCompleted);
    } catch { setError("Failed to load"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleShare() {
    await fetch("/api/ramadan/share", { method: "POST" });
    const msg = encodeURIComponent(
      `🌙 Dag ${currentDay}/30! ${enrollment?.childName} doet de Ramadan Challenge! Masha'Allah!\nOok meedoen? → ${window.location.origin}/ramadan-challenge`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
    fetchData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f172a", color: "#fff" }}>Loading...</div>;
  if (!enrollment) return null;

  const todayData = days.find(d => d.isToday);
  const pct = Math.round((totalCompleted / 30) * 100);
  const allBadgeIds = Object.values(BADGES);

  return (
    <div className="min-h-screen" style={{ background: "#0f172a", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.95)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#f5c842" }}>&#127769; Ramadan Challenge</span>
          <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="p-3 rounded-lg bg-red-500/20 text-red-300 text-sm mb-4">{error}</div>}

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-white/50 text-sm">Ramadan Mubarak!</p>
          <h1 className="text-2xl font-extrabold mb-1">
            {enrollment.childName}&apos;s Ramadan Journey
          </h1>
          {currentDay && <p className="text-lg" style={{ color: "#f5c842" }}>Day {currentDay} of 30</p>}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-2xl font-extrabold" style={{ color: "#1a6b4a" }}>{totalCompleted}/30</div>
            <div className="text-xs text-white/40">Completed</div>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-2xl font-extrabold" style={{ color: "#f5c842" }}>🔥 {enrollment.streakDays}</div>
            <div className="text-xs text-white/40">Streak</div>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-2xl font-extrabold">{enrollment.badgesEarned.length}</div>
            <div className="text-xs text-white/40">Badges</div>
          </div>
        </div>

        {/* Progress ring */}
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1a6b4a" strokeWidth="8"
                strokeDasharray={`${pct * 2.64} ${264 - pct * 2.64}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{pct}%</div>
          </div>
        </div>

        {/* Today's activity */}
        {todayData && !todayData.completed && (
          <div className="rounded-2xl p-6 mb-8" style={{ background: "linear-gradient(135deg, rgba(245,200,66,0.15), rgba(26,107,74,0.15))", border: "1px solid rgba(245,200,66,0.3)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>TODAY — DAY {todayData.dayNumber}</span>
              <span className="text-xs text-white/40">{todayData.activityType}</span>
            </div>
            <h2 className="text-xl font-bold mb-1">{todayData.title}</h2>
            <p className="text-sm text-white/50 mb-1" style={{ fontFamily: "'Amiri', serif" }}>{todayData.titleAr}</p>
            {todayData.duaOfDay && <p className="text-sm text-white/60 italic mb-1">🤲 {todayData.duaOfDay}</p>}
            {todayData.hadithOfDay && <p className="text-xs text-white/40 mb-3">📖 {todayData.hadithOfDay}</p>}
            <Link href={`/ramadan-challenge/day/${todayData.dayNumber}`}
              className="inline-block px-6 py-2.5 rounded-lg font-bold text-sm" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
              Start Activity &rarr;
            </Link>
          </div>
        )}

        {/* Calendar grid */}
        <h3 className="font-bold mb-3">Calendar</h3>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mb-8">
          {days.map(d => (
            <Link
              key={d.id}
              href={d.unlocked ? `/ramadan-challenge/day/${d.dayNumber}` : "#"}
              className="aspect-square rounded-xl flex flex-col items-center justify-center text-center transition-all"
              style={{
                backgroundColor: d.completed ? "rgba(26,107,74,0.3)" : d.isToday ? "rgba(245,200,66,0.2)" : d.unlocked ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                border: d.isToday ? "2px solid #f5c842" : d.completed ? "1px solid rgba(26,107,74,0.5)" : "1px solid rgba(255,255,255,0.05)",
                opacity: d.unlocked ? 1 : 0.4,
                pointerEvents: d.unlocked ? "auto" : "none",
              }}
            >
              <span className="text-lg font-bold">{d.completed ? "✓" : d.unlocked ? d.dayNumber : "🔒"}</span>
              <span className="text-[10px] text-white/40 mt-0.5 truncate px-1 w-full">{d.title.slice(0, 12)}</span>
            </Link>
          ))}
        </div>

        {/* Badges shelf */}
        <h3 className="font-bold mb-3">Badges</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-8">
          {allBadgeIds.map(badge => {
            const earned = enrollment.badgesEarned.includes(badge.id);
            return (
              <div key={badge.id} className="text-center p-3 rounded-xl" style={{
                backgroundColor: earned ? "rgba(245,200,66,0.15)" : "rgba(255,255,255,0.03)",
                border: earned ? "1px solid rgba(245,200,66,0.3)" : "1px solid rgba(255,255,255,0.05)",
                opacity: earned ? 1 : 0.4,
              }}>
                <div className="text-2xl mb-1">{badge.emoji}</div>
                <p className="text-xs font-medium">{badge.name}</p>
              </div>
            );
          })}
        </div>

        {/* Share */}
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
          <p className="font-medium mb-2">Share {enrollment.childName}&apos;s Progress</p>
          <button onClick={handleShare} className="px-6 py-2.5 rounded-lg text-sm font-bold" style={{ backgroundColor: "#25D366", color: "#fff" }}>
            Share via WhatsApp
          </button>
          <p className="text-xs text-white/30 mt-2">Shares: {enrollment.shareCount} {enrollment.shareCount >= 3 ? "🏆 Ambassador!" : `(${3 - enrollment.shareCount} more for Ambassador badge)`}</p>
        </div>

        {/* Certificate link */}
        {totalCompleted >= 30 && (
          <div className="mt-6 text-center">
            <Link href="/ramadan-challenge/certificate" className="px-8 py-3 rounded-xl font-bold text-lg inline-block" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
              🎉 Download Certificate
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
