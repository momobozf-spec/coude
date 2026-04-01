"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { METHODS, MethodKey } from "@/lib/prayer";

interface PrayerData {
  times: { fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string };
  qibla: number;
  distanceToMecca: number;
  nextPrayer: { name: string; time: string } | null;
  method: string;
  date: string;
}

const PRAYER_INFO = [
  { key: "fajr", name: "Fajr", nameAr: "الفجر", icon: "🌅", color: "#1e3a5f" },
  { key: "sunrise", name: "Sunrise", nameAr: "الشروق", icon: "☀️", color: "#e67e22" },
  { key: "dhuhr", name: "Dhuhr", nameAr: "الظهر", icon: "🌤️", color: "#f39c12" },
  { key: "asr", name: "Asr", nameAr: "العصر", icon: "⛅", color: "#d4a843" },
  { key: "maghrib", name: "Maghrib", nameAr: "المغرب", icon: "🌇", color: "#e74c3c" },
  { key: "isha", name: "Isha", nameAr: "العشاء", icon: "🌙", color: "#2c3e50" },
];

export default function PrayerPage() {
  const [data, setData] = useState<PrayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<MethodKey>("MWL");
  const [locationName, setLocationName] = useState("");
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

  const fetchPrayer = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prayer?lat=${lat}&lng=${lng}&method=${method}`);
      const d = await res.json();
      setData(d);

      // Reverse geocode for location name
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`);
        const geo = await geoRes.json();
        setLocationName(geo.address?.city || geo.address?.town || geo.address?.village || geo.display_name?.split(",")[0] || "");
      } catch { /* silent */ }
    } catch { setError("Failed to load prayer times"); }
    setLoading(false);
  }, [method]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchPrayer(pos.coords.latitude, pos.coords.longitude),
        () => { setError("Location access needed for prayer times. Please allow location access."); setLoading(false); },
        { enableHighAccuracy: true }
      );
    } else {
      setError("Geolocation not supported");
      setLoading(false);
    }
  }, [fetchPrayer]);

  // Device compass for Qibla
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.alpha !== null) setDeviceHeading(e.alpha);
    }

    if (typeof DeviceOrientationEvent !== "undefined") {
      // @ts-expect-error - requestPermission is iOS only
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        // iOS 13+ needs permission
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
      }
    }
  }, []);

  // Countdown to next prayer
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
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data]);

  const qiblaRotation = data ? (deviceHeading !== null ? data.qibla - deviceHeading : data.qibla) : 0;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.9)" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">&larr; Dashboard</Link>
          <span className="font-bold" style={{ color: "#c9920a" }}>&#127769; Prayer Times</span>
          <select value={method} onChange={e => setMethod(e.target.value as MethodKey)}
            className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white/70 outline-none">
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.name}</option>)}
          </select>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="spinner mx-auto mb-3" style={{ borderColor: "#c9920a", borderTopColor: "transparent" }} />
            <p className="text-white/50 text-sm">Detecting your location...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">&#128205;</div>
            <p className="text-white/70 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "#c9920a" }}>Try Again</button>
          </div>
        ) : data ? (
          <>
            {/* Location + Date */}
            <div className="text-center mb-6">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{data.date}</p>
              <h1 className="text-xl font-bold">{locationName || "Your Location"}</h1>
              <p className="text-white/40 text-xs mt-1">{data.method}</p>
            </div>

            {/* Next prayer countdown */}
            {data.nextPrayer && (
              <div className="rounded-2xl p-5 mb-6 text-center" style={{ background: "linear-gradient(135deg, rgba(201,146,10,0.2), rgba(13,148,136,0.2))", border: "1px solid rgba(201,146,10,0.3)" }}>
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Next Prayer</p>
                <p className="text-2xl font-extrabold" style={{ color: "#c9920a" }}>{data.nextPrayer.name}</p>
                <p className="text-lg text-white/80">{data.nextPrayer.time}</p>
                <p className="text-sm text-white/40 mt-1">in {countdown}</p>
              </div>
            )}

            {/* Prayer times list */}
            <div className="space-y-2 mb-8">
              {PRAYER_INFO.map(p => {
                const time = data.times[p.key as keyof typeof data.times];
                const isNext = data.nextPrayer?.name === p.name;
                return (
                  <div key={p.key} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all" style={{
                    backgroundColor: isNext ? "rgba(201,146,10,0.15)" : "rgba(255,255,255,0.04)",
                    border: isNext ? "1px solid rgba(201,146,10,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span className="text-xl w-8 text-center">{p.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-white/30" style={{ fontFamily: "'Amiri', serif" }}>{p.nameAr}</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: isNext ? "#c9920a" : "rgba(255,255,255,0.8)" }}>
                      {time}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Qibla Compass */}
            <div className="text-center mb-8">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Qibla Direction</h2>
              <div className="relative w-56 h-56 mx-auto">
                {/* Compass ring */}
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                  {/* Cardinal directions */}
                  <text x="100" y="22" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="bold">N</text>
                  <text x="100" y="192" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11">S</text>
                  <text x="13" y="104" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11">W</text>
                  <text x="187" y="104" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11">E</text>

                  {/* Tick marks */}
                  {Array.from({ length: 36 }, (_, i) => {
                    const angle = i * 10 * (Math.PI / 180);
                    const r1 = i % 9 === 0 ? 73 : 78;
                    return <line key={i} x1={100 + Math.sin(angle) * r1} y1={100 - Math.cos(angle) * r1} x2={100 + Math.sin(angle) * 83} y2={100 - Math.cos(angle) * 83} stroke="rgba(255,255,255,0.15)" strokeWidth={i % 9 === 0 ? 2 : 0.5} />;
                  })}

                  {/* Qibla arrow */}
                  <g transform={`rotate(${qiblaRotation}, 100, 100)`}>
                    <line x1="100" y1="100" x2="100" y2="30" stroke="#c9920a" strokeWidth="3" strokeLinecap="round" />
                    <polygon points="100,25 94,40 106,40" fill="#c9920a" />
                    {/* Kaaba icon */}
                    <rect x="94" y="18" width="12" height="12" rx="1" fill="#c9920a" stroke="white" strokeWidth="1" />
                  </g>

                  {/* Center dot */}
                  <circle cx="100" cy="100" r="4" fill="white" />
                  <circle cx="100" cy="100" r="2" fill="#c9920a" />
                </svg>
              </div>

              <p className="text-sm mt-3">
                <span className="font-bold" style={{ color: "#c9920a" }}>{data.qibla}&deg;</span>
                <span className="text-white/40"> from North</span>
              </p>
              <p className="text-xs text-white/30 mt-1">{data.distanceToMecca.toLocaleString()} km to Makkah</p>
              {deviceHeading === null && (
                <p className="text-xs text-white/20 mt-2">Rotate your phone for live compass</p>
              )}
            </div>

            {/* Quick info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <p className="text-2xl mb-1">&#128331;</p>
                <p className="text-xs text-white/50">Qibla</p>
                <p className="font-bold" style={{ color: "#c9920a" }}>{data.qibla}&deg;</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <p className="text-2xl mb-1">&#128205;</p>
                <p className="text-xs text-white/50">To Makkah</p>
                <p className="font-bold text-white/80">{data.distanceToMecca.toLocaleString()} km</p>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <footer className="text-center py-6 text-xs text-white/20 border-t border-white/5">
        Noor Printables &mdash; Prayer times calculated locally using astronomical algorithms
      </footer>
    </div>
  );
}
