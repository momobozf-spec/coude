"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface PrayerData {
  times: { fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string };
  nextPrayer: { name: string; time: string } | null;
  qibla: number;
}

export default function PrayerWidget() {
  const [data, setData] = useState<PrayerData | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`/api/prayer?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
            const d = await res.json();
            setData(d);
          } catch { /* silent */ }
        },
        () => { /* silent - widget just won't show */ },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    if (!data?.nextPrayer) return;
    const tick = () => {
      const [h, m] = data.nextPrayer!.time.split(":").map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const diff = target.getTime() - now.getTime();
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setCountdown(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [data]);

  if (!data) return null;

  return (
    <Link href="/prayer" className="card block hover:shadow-md transition-all" style={{ borderColor: "#1e293b", background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">&#127769;</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40">Next prayer</p>
          <p className="font-bold text-white">{data.nextPrayer?.name} <span className="font-normal text-white/60">{data.nextPrayer?.time}</span></p>
          <p className="text-xs text-white/30">in {countdown}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/30">Qibla</p>
          <p className="font-bold text-sm" style={{ color: "#c9920a" }}>{data.qibla}&deg;</p>
        </div>
      </div>
    </Link>
  );
}
