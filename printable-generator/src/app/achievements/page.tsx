"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface BadgeItem { id: string; slug: string; name: string; description: string; iconEmoji: string; color: string; category: string; tier: string; xpReward: number; isSecret: boolean; earned: boolean; }
interface ProgressData { totalXp: number; level: number; levelName: string; xpForNextLevel: number; worksheetsCompleted: number; currentStreak: number; longestStreak: number; badgeCount: number; totalBadges: number; }
interface CertItem { id: string; title: string; childName: string; publicToken: string; issuedAt: string; }

const CATEGORIES = ["All", "completion", "streak", "alphabet", "ramadan", "theme", "course", "sharing", "special"];
const TIER_COLORS: Record<string, string> = { bronze: "#cd7f32", silver: "#c0c0c0", gold: "#c9920a", platinum: "#7c3aed" };

export default function AchievementsPage() {
  const { data: session } = useSession();
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [certs, setCerts] = useState<CertItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/achievements/badges").then(r => r.json()),
      session ? fetch("/api/achievements/progress").then(r => r.json()) : Promise.resolve(null),
    ]).then(([bData, pData]) => {
      setBadges(bData.badges || []);
      if (pData) { setProgress(pData.progress); setCerts(pData.certificates || []); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session]);

  const filtered = filter === "All" ? badges : badges.filter(b => b.category === filter);
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="text-sm text-gray-500">&larr; Dashboard</Link>
          <span className="font-bold" style={{ color: "#1a6b4a" }}>Achievements</span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Level + XP hero */}
        {progress && (
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">&#127942;</div>
            <h1 className="text-2xl font-extrabold">Level {progress.level}: {progress.levelName}</h1>
            <p className="text-gray-500 text-sm mb-3">{progress.totalXp} XP</p>
            <div className="max-w-sm mx-auto">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Level {progress.level}</span>
                <span>{progress.xpForNextLevel} XP</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (progress.totalXp / progress.xpForNextLevel) * 100)}%`, backgroundColor: "#1a6b4a" }} />
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {progress && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { icon: "🔥", label: "Streak", value: `${progress.currentStreak}d` },
              { icon: "📚", label: "Completed", value: progress.worksheetsCompleted },
              { icon: "⭐", label: "Badges", value: `${progress.badgeCount}/${progress.totalBadges}` },
              { icon: "🏆", label: "Level", value: progress.level },
            ].map((s, i) => (
              <div key={i} className="card text-center py-3">
                <div className="text-xl">{s.icon}</div>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto mb-6">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={filter === cat ? { backgroundColor: "#1a6b4a", color: "#fff" } : { backgroundColor: "#fff", color: "#666", border: "1px solid #e0dbd3" }}>
              {cat === "All" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Badges grid */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading badges...</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
            {filtered.map(badge => (
              <div key={badge.id} className="card text-center py-4 px-2 transition-all" style={{
                opacity: badge.earned ? 1 : 0.4,
                borderColor: badge.earned ? TIER_COLORS[badge.tier] || "#ddd" : undefined,
                borderWidth: badge.earned ? 2 : undefined,
              }}>
                <div className="text-3xl mb-1">{badge.earned ? badge.iconEmoji : badge.isSecret ? "❓" : badge.iconEmoji}</div>
                <p className="text-xs font-bold text-gray-900 truncate">{badge.name}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: TIER_COLORS[badge.tier] || "#999" }}>
                  {badge.tier.toUpperCase()} &middot; {badge.xpReward} XP
                </p>
                {badge.earned ? (
                  <p className="text-[10px] mt-1" style={{ color: "#1a6b4a" }}>&#10003; Earned</p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1 truncate">{badge.description.slice(0, 30)}...</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certificates */}
        {certs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Your Certificates ({certs.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certs.map(c => (
                <div key={c.id} className="card flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: "#e8f5ec" }}>&#127942;</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.childName} &middot; {new Date(c.issuedAt).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/achievements/certificate/${c.publicToken}`} className="text-xs font-medium hover:underline" style={{ color: "#1a6b4a" }}>
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="text-center text-gray-400 text-sm">
          {earnedCount} of {badges.length} badges earned &middot; Keep going!
        </div>
      </div>
    </div>
  );
}
