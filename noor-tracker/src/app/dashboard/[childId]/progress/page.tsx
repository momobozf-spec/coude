"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { HABITS, getHabitsForPlan, getAvatarEmoji } from "@/lib/habits";
import { getLast7Days, getDayName, calculateStreak } from "@/lib/utils";
import { getEarnedBadges, BADGES } from "@/lib/badges";
import { UpgradeModal } from "../../_components/UpgradeModal";

interface HabitLog {
  date: string;
  habits: Record<string, boolean>;
  stars: number;
}

interface ProgressData {
  logs: HabitLog[];
  isPro: boolean;
  child: { name: string; avatar: string };
}

export default function ProgressPage() {
  const params = useParams();
  const { data: session } = useSession();
  const childId = params.childId as string;

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const plan = session?.user?.plan ?? "free";
  const habits = getHabitsForPlan(plan);
  const last7 = getLast7Days();

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/progress/${childId}`);
    if (res.ok) {
      const payload = (await res.json()) as ProgressData;
      setData(payload);
    }
    setLoading(false);
  }, [childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">Kon data niet laden.</p>
      </div>
    );
  }

  const streak = calculateStreak(data.logs, habits.length);
  const totalStars = data.logs.reduce((sum, log) => sum + log.stars, 0);
  const earnedBadges = getEarnedBadges(totalStars, streak, plan);

  const heatmapData = last7.map((date) => {
    const log = data.logs.find((entry) => entry.date === date);
    const stars = log?.stars ?? 0;
    const total = habits.length;
    const percent = total > 0 ? stars / total : 0;

    return {
      date,
      dayName: getDayName(date),
      stars,
      total,
      percent,
    };
  });

  const habitStats = HABITS.filter((habit) => habit.free || plan === "pro").map(
    (habit) => {
      const completedDays = last7.filter((date) => {
        const log = data.logs.find((entry) => entry.date === date);
        if (!log) return false;
        return log.habits[habit.id] === true;
      }).length;

      return {
        ...habit,
        completedDays,
        percent: Math.round((completedDays / 7) * 100),
      };
    }
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-emerald-700 hover:text-emerald-800 p-2 -ml-2 rounded-xl hover:bg-emerald-50 transition-colors"
        >
          {"\u2190"}
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
            {getAvatarEmoji(data.child.avatar)}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">
              {data.child.name}
            </h1>
            <p className="text-sm text-gray-500">Voortgang</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 text-center">
          <div className="text-3xl mb-1">{"\uD83D\uDD25"}</div>
          <div className="text-2xl font-extrabold text-gray-900">{streak}</div>
          <div className="text-xs text-gray-500">Streak</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 text-center">
          <div className="text-3xl mb-1">{"\u2B50"}</div>
          <div className="text-2xl font-extrabold text-gold-500">
            {totalStars}
          </div>
          <div className="text-xs text-gray-500">Totaal sterren</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 text-center">
          <div className="text-3xl mb-1">{"\uD83D\uDCC5"}</div>
          <div className="text-2xl font-extrabold text-emerald-700">
            {data.logs.length}
          </div>
          <div className="text-xs text-gray-500">Actieve dagen</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-emerald-100 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Afgelopen 7 dagen
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {heatmapData.map((day) => (
            <div key={day.date} className="text-center">
              <div className="text-xs text-gray-500 mb-2">
                {day.dayName.slice(0, 2)}
              </div>
              <div
                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                  day.percent >= 0.8
                    ? "bg-emerald-500 text-white"
                    : day.percent >= 0.4
                      ? "bg-emerald-200 text-emerald-800"
                      : day.percent > 0
                        ? "bg-gold-100 text-gold-700"
                        : "bg-gray-100 text-gray-400"
                }`}
              >
                {day.stars > 0 ? day.stars : "\u2014"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {day.date.slice(8)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded" />
            Gemist
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gold-100 rounded" />
            Deels
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-200 rounded" />
            Goed
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-500 rounded" />
            Super
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-emerald-100 mb-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-bold text-gray-900">Badge systeem</h2>
          {plan !== "pro" && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-sm font-bold text-gold-700"
            >
              Pro unlock
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {(plan === "pro" ? BADGES : BADGES.filter((badge) => !badge.proOnly)).map(
            (badge) => {
              const earned = earnedBadges.some((entry) => entry.id === badge.id);

              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl border p-4 ${
                    earned
                      ? "border-gold-200 bg-gold-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{badge.emoji}</span>
                    <div>
                      <p className="font-bold text-gray-900">{badge.title}</p>
                      {badge.proOnly && (
                        <span className="text-xs font-bold text-gold-700">
                          Pro
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{badge.description}</p>
                  <p className="text-xs mt-2 font-medium text-gray-500">
                    {earned ? "Behaald" : "Nog niet behaald"}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-emerald-100 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Per gewoonte (7 dagen)
        </h2>
        <div className="space-y-3">
          {habitStats.map((stat) => (
            <div key={stat.id} className="flex items-center gap-3">
              <span className="text-xl w-8">{stat.emoji}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{stat.dutch}</span>
                  <span className="text-gray-500">
                    {stat.completedDays}/7 dagen
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${stat.percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!data.isPro && (
        <div className="relative bg-white rounded-3xl p-6 border border-emerald-100 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <div className="text-3xl mb-2">{"\uD83D\uDD12"}</div>
            <h3 className="font-bold text-gray-900 mb-1">
              Volledige geschiedenis
            </h3>
            <p className="text-sm text-gray-600 mb-4 text-center px-4">
              Upgrade naar Pro om meer dan 7 dagen terug te kijken.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-emerald-700 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-emerald-800 transition-colors"
            >
              Upgrade naar Pro
            </button>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Maandoverzicht
          </h2>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }).map((_, index) => (
              <div key={index} className="aspect-square rounded bg-gray-100" />
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          href={`/dashboard/${childId}/today`}
          className="inline-flex items-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-full font-bold hover:bg-emerald-800 transition-colors"
        >
          {"\u2190"} Terug naar tracker
        </Link>
      </div>

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          message="Upgrade naar Pro voor badges, volledige geschiedenis en meer."
        />
      )}
    </div>
  );
}
