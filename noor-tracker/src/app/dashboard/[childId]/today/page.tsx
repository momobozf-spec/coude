"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { HABITS, getHabitsForPlan, countStars, getAvatarEmoji } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import { UpgradeModal } from "../../_components/UpgradeModal";

interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
}

export default function DailyTrackerPage() {
  const params = useParams();
  const { data: session } = useSession();
  const childId = params.childId as string;

  const [habits, setHabits] = useState<Record<string, boolean>>({});
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [savedStars, setSavedStars] = useState(0);

  const plan = session?.user?.plan ?? "free";
  const availableHabits = getHabitsForPlan(plan);
  const today = getToday();

  const fetchData = useCallback(async () => {
    const [childRes, logRes] = await Promise.all([
      fetch("/api/children"),
      fetch(`/api/habits/${childId}/${today}`),
    ]);

    if (childRes.ok) {
      const children = await childRes.json();
      const c = children.find((ch: ChildInfo) => ch.id === childId);
      if (c) setChild(c);
    }

    if (logRes.ok) {
      const log = await logRes.json();
      if (log.habits && typeof log.habits === "object") {
        setHabits(log.habits as Record<string, boolean>);
      }
    }

    setLoading(false);
  }, [childId, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleHabit(habitId: string) {
    const habit = HABITS.find((h) => h.id === habitId);
    if (habit && !habit.free && plan !== "pro") {
      setShowUpgrade(true);
      return;
    }

    setHabits((prev) => ({
      ...prev,
      [habitId]: !prev[habitId],
    }));
  }

  async function saveDay() {
    setSaving(true);
    const res = await fetch(`/api/habits/${childId}/${today}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habits }),
    });

    if (res.ok) {
      const stars = countStars(habits);
      setSavedStars(stars);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3500);
    }
    setSaving(false);
  }

  const currentStars = countStars(habits);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-6 w-32" />
        <div className="grid gap-3 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-emerald-700 hover:text-emerald-800 p-2 -ml-2 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            {"\u2190"}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
              {child ? getAvatarEmoji(child.avatar) : "\u2B50"}
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">
                {child?.name ?? "Laden..."}
              </h1>
              <p className="text-sm text-gray-500">Vandaag</p>
            </div>
          </div>
        </div>

        <Link
          href={`/dashboard/${childId}/progress`}
          className="text-sm text-emerald-700 font-medium hover:underline"
        >
          Voortgang {"\u2192"}
        </Link>
      </div>

      {/* Stars counter */}
      <div className="bg-gradient-to-r from-gold-50 to-gold-100 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gold-700 font-medium">Sterren vandaag</p>
          <p className="text-3xl font-extrabold text-gold-600">
            {currentStars}
            <span className="text-lg text-gold-400">
              /{availableHabits.length}
            </span>
          </p>
        </div>
        <div className="text-4xl">
          {currentStars > 0 ? "\u2B50" : "\u{1F31F}"}
        </div>
      </div>

      {/* Habit cards */}
      <div className="space-y-3 mb-8">
        {HABITS.map((habit) => {
          const isCompleted = habits[habit.id] ?? false;
          const isLocked = !habit.free && plan !== "pro";

          return (
            <button
              key={habit.id}
              onClick={() => toggleHabit(habit.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                isLocked
                  ? "border-gray-200 bg-gray-50 opacity-70"
                  : isCompleted
                  ? "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100"
                  : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
              }`}
            >
              <div
                className={`text-3xl transition-transform ${
                  isCompleted ? "scale-110" : ""
                }`}
              >
                {habit.emoji}
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      isCompleted ? "text-emerald-700" : "text-gray-900"
                    }`}
                  >
                    {habit.dutch}
                  </span>
                  {isLocked && (
                    <span className="bg-gold-100 text-gold-700 text-xs px-2 py-0.5 rounded-full font-bold">
                      PRO
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500 font-arabic" dir="rtl">
                  {habit.arabic}
                </span>
              </div>

              <div>
                {isLocked ? (
                  <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400">
                    {"\uD83D\uDD12"}
                  </div>
                ) : isCompleted ? (
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white celebration-star">
                    {"\u2713"}
                  </div>
                ) : (
                  <div className="w-8 h-8 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Save button */}
      <div className="sticky bottom-4 safe-bottom">
        <button
          onClick={saveDay}
          disabled={saving || currentStars === 0}
          className="w-full bg-emerald-700 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
        >
          {saving ? (
            "Opslaan..."
          ) : (
            <>
              Dag opslaan {"\u2B50"} {currentStars} sterren
            </>
          )}
        </button>
      </div>

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
          {/* Falling stars */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-star-fall"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {"\u2B50"}
            </div>
          ))}

          <div className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4 animate-bounce-in relative z-10">
            <div className="text-6xl mb-4 celebration-star">
              {"\u2B50"}
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              Je hebt {savedStars} sterren verdiend!
            </h2>
            <p className="text-3xl font-bold text-emerald-700 mb-2" dir="rtl">
              {"\u0645\u0627 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647"}
            </p>
            <p className="text-gray-500 text-sm">
              Geweldig gedaan! Ga zo door!
            </p>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          message="Upgrade naar Pro om alle gewoontes te ontgrendelen."
        />
      )}
    </div>
  );
}
