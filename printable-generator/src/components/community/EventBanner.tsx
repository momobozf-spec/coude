"use client";

import { useState, useEffect } from "react";

export default function EventBanner() {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    // Next Tuesday at 20:00 CET
    function getNextTuesday(): Date {
      const now = new Date();
      const d = new Date(now);
      d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
      d.setHours(20, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 7);
      return d;
    }

    function tick() {
      const next = getNextTuesday();
      const diff = next.getTime() - Date.now();
      if (diff <= 0) { setCountdown("Starting now!"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      setCountdown(days > 0 ? `In ${days}d ${hours}h` : `In ${hours}h`);
    }

    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card flex items-center gap-3 py-3" style={{ backgroundColor: "#fdf8ef", borderColor: "#c9920a" }}>
      <span className="text-2xl">&#128197;</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-900">Weekly Islamic Q&A</p>
        <p className="text-xs text-gray-500">Tuesday 8:00 PM CET &mdash; {countdown}</p>
      </div>
      <button
        onClick={() => {
          // Google Calendar link
          const title = encodeURIComponent("Noor Families — Weekly Islamic Q&A");
          const details = encodeURIComponent("Join the weekly Q&A in the Noor Families community");
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`, "_blank");
        }}
        className="text-xs px-3 py-1.5 rounded-lg font-medium"
        style={{ backgroundColor: "#c9920a", color: "#fff" }}
      >
        &#128197; Add to Calendar
      </button>
    </div>
  );
}
