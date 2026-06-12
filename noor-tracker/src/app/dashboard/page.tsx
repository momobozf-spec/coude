"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAvatarEmoji, getHabitsForPlan } from "@/lib/habits";
import { getToday, calculateStreak } from "@/lib/utils";
import { AddChildModal } from "./_components/AddChildModal";
import { UpgradeModal } from "./_components/UpgradeModal";

interface HabitLog {
  date: string;
  habits: Record<string, boolean>;
  stars: number;
}

interface Child {
  id: string;
  name: string;
  age: number;
  avatar: string;
  logs: HabitLog[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const plan = session?.user?.plan ?? "free";
  const habits = getHabitsForPlan(plan);
  const today = getToday();

  const fetchChildren = useCallback(async () => {
    const res = await fetch("/api/children");
    if (res.ok) {
      const data = await res.json();
      setChildren(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  function handleAddChild() {
    const maxChildren = plan === "pro" ? 3 : 1;
    if (children.length >= maxChildren) {
      setShowUpgrade(true);
    } else {
      setShowAddChild(true);
    }
  }

  function getTodayProgress(child: Child) {
    const todayLog = child.logs.find((l) => l.date === today);
    if (!todayLog) return { done: 0, total: habits.length };
    const done = Object.values(todayLog.habits as Record<string, boolean>).filter(Boolean).length;
    return { done, total: habits.length };
  }

  function getStreak(child: Child) {
    return calculateStreak(child.logs, habits.length);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64 mb-8" />
        <div className="grid sm:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-48 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Assalamu alaikum{session?.user?.name ? `, ${session.user.name}` : ""}{" "}
            {"\uD83D\uDC4B"}
          </h1>
          <p className="text-gray-600 mt-1">
            {children.length === 0
              ? "Voeg je eerste kind toe om te beginnen."
              : "Bekijk de voortgang van je kinderen."}
          </p>
        </div>
      </div>

      {/* Children grid */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {children.map((child) => {
          const progress = getTodayProgress(child);
          const streak = getStreak(child);
          const progressPercent =
            progress.total > 0
              ? Math.round((progress.done / progress.total) * 100)
              : 0;

          return (
            <Link
              key={child.id}
              href={`/dashboard/${child.id}/today`}
              className="bg-white rounded-3xl p-6 border border-emerald-100 hover:shadow-lg hover:shadow-emerald-50 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {getAvatarEmoji(child.avatar)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {child.name}
                    </h3>
                    <p className="text-sm text-gray-500">{child.age} jaar</p>
                  </div>
                </div>

                {streak > 0 && (
                  <div className="flex items-center gap-1 bg-gold-50 text-gold-700 px-3 py-1 rounded-full text-sm font-bold">
                    {"\uD83D\uDD25"} {streak}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Vandaag</span>
                  <span className="font-bold text-emerald-700">
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-gold-500 font-bold">
                  {"\u2B50"}{" "}
                  {child.logs.reduce((sum, l) => sum + l.stars, 0)} sterren
                </div>
                <span className="text-emerald-700 text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Tracker openen {"\u2192"}
                </span>
              </div>
            </Link>
          );
        })}

        {/* Add child card */}
        <button
          onClick={handleAddChild}
          className="bg-white/50 border-2 border-dashed border-emerald-200 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[200px] hover:bg-emerald-50 hover:border-emerald-400 transition-all group"
        >
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
            {"\u2795"}
          </div>
          <span className="font-bold text-emerald-700">Kind toevoegen</span>
          {plan === "free" && children.length >= 1 && (
            <span className="text-xs text-gold-600 mt-1 flex items-center gap-1">
              {"\uD83D\uDD12"} Pro vereist
            </span>
          )}
        </button>
      </div>

      {/* Quick tips for empty state */}
      {children.length === 0 && (
        <div className="bg-emerald-50 rounded-3xl p-8 text-center border border-emerald-100">
          <div className="text-5xl mb-4">{"\uD83C\uDF1F"}</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Begin met je eerste kind!
          </h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
            Voeg je kind toe en begin met het bijhouden van islamitische
            gewoontes. Elke dag verdient je kind sterren voor goede gewoontes!
          </p>
          <button
            onClick={() => setShowAddChild(true)}
            className="bg-emerald-700 text-white px-6 py-3 rounded-full font-bold hover:bg-emerald-800 transition-colors inline-flex items-center gap-2"
          >
            {"\u2795"} Kind toevoegen
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddChild && (
        <AddChildModal
          onClose={() => setShowAddChild(false)}
          onAdded={fetchChildren}
        />
      )}

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          message="Upgrade naar Pro om meerdere kinderen toe te voegen."
        />
      )}
    </div>
  );
}
