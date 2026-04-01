"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function RamadanChallengePage() {
  const { data: session } = useSession();
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(6);
  const [enrolling, setEnrolling] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0 });
  const [isEarly, setIsEarly] = useState(true);

  // Countdown to Ramadan 2026
  useEffect(() => {
    const ramadanStart = new Date("2026-02-18T00:00:00");
    const tick = () => {
      const now = new Date();
      const diff = ramadanStart.getTime() - now.getTime();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, mins: 0 }); return; }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
      });
      setIsEarly(diff > 30 * 86400000);
    };
    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  async function handleEnroll() {
    if (!session) { window.location.href = "/register"; return; }
    if (!childName.trim()) return;
    setEnrolling(true);
    try {
      const res = await fetch("/api/ramadan/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childName, childAge }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.enrolled) window.location.href = "/ramadan-challenge/dashboard";
    } catch { /* */ }
    setEnrolling(false);
  }

  const price = isEarly ? "$9.99" : "$14.99";
  const oldPrice = isEarly ? "$14.99" : null;

  return (
    <div className="min-h-screen" style={{ background: "#0f172a", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {/* Animated stars CSS */}
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.3} 50%{opacity:1} }
        .star { position:absolute; border-radius:50%; animation:twinkle 2s infinite; }
      `}</style>

      {/* Nav */}
      <nav className="border-b border-white/10 sticky top-0 z-50 backdrop-blur" style={{ backgroundColor: "rgba(15,23,42,0.9)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-lg font-bold" style={{ color: "#f5c842" }}>&#127769; Noor Printables</Link>
          <div className="flex gap-2">
            {session ? (
              <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">Dashboard</Link>
            ) : (
              <Link href="/login" className="text-sm text-white/60 hover:text-white">Log in</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero with stars */}
      <section className="relative px-4 pt-16 pb-20 text-center overflow-hidden">
        {/* CSS stars */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="star" style={{
            width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            backgroundColor: "#f5c842", animationDelay: `${Math.random() * 3}s`,
          }} />
        ))}

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="text-6xl mb-4">&#127769;</div>
          <p className="text-sm font-bold tracking-widest mb-3" style={{ color: "#f5c842" }}>30 DAYS OF RAMADAN</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3">
            Islamic Activities
            <br />
            <span style={{ color: "#f5c842" }}>for Kids Aged 4-8</span>
          </h1>
          <p className="text-xl mb-2" style={{ fontFamily: "'Amiri', serif", color: "rgba(255,255,255,0.6)" }}>رمضان مع نور</p>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Every day of Ramadan, a new Islamic activity unlocks for your child.
            Coloring pages, mazes, word searches, Arabic tracing, daily duas &amp; more.
          </p>

          {/* Countdown */}
          {countdown.days > 0 && (
            <div className="flex justify-center gap-4 mb-8">
              {[
                { val: countdown.days, label: "Days" },
                { val: countdown.hours, label: "Hours" },
                { val: countdown.mins, label: "Mins" },
              ].map((t, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-extrabold" style={{ color: "#f5c842" }}>{t.val}</div>
                  <div className="text-xs text-white/40">{t.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Price + CTA */}
          <div className="max-w-sm mx-auto rounded-2xl p-6 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,200,66,0.2)" }}>
            <div className="mb-4">
              {oldPrice && <span className="text-white/40 line-through mr-2">{oldPrice}</span>}
              <span className="text-3xl font-extrabold" style={{ color: "#f5c842" }}>{price}</span>
              {isEarly && <span className="ml-2 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(245,200,66,0.2)", color: "#f5c842" }}>EARLY BIRD</span>}
            </div>

            <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Child's name"
              className="w-full mb-2 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm outline-none focus:border-yellow-400" />
            <select value={childAge} onChange={e => setChildAge(Number(e.target.value))}
              className="w-full mb-3 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm outline-none">
              {[4, 5, 6, 7, 8].map(a => <option key={a} value={a} style={{ color: "#000" }}>Age {a}</option>)}
            </select>

            <button onClick={handleEnroll} disabled={enrolling || !childName.trim()}
              className="w-full py-3.5 rounded-lg font-bold text-lg transition-all disabled:opacity-50"
              style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
              {enrolling ? "Loading..." : `Join Now — ${price}`}
            </button>
            <p className="text-xs text-white/30 mt-2">2,847 families joined &middot; 1 purchase = whole family</p>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="px-4 py-16" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">What&apos;s Inside</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: "🎨", text: "30 unique worksheets" },
              { icon: "🤲", text: "Daily dua for kids" },
              { icon: "📖", text: "Daily hadith" },
              { icon: "🏆", text: "Collectible badges" },
              { icon: "📜", text: "Completion certificate" },
              { icon: "📱", text: "Print OR color digitally" },
            ].map((f, i) => (
              <div key={i} className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-sm text-white/80">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Buy the pack", desc: "One-time payment, whole family access" },
              { step: "2", title: "New activity daily", desc: "Each day of Ramadan, a new worksheet unlocks" },
              { step: "3", title: "Collect badges", desc: "Earn badges for streaks, milestones & sharing" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>{s.step}</div>
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-sm text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview days 1-3 */}
      <section className="px-4 py-16" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Preview: First 3 Days</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { day: 1, title: "Bismillah", type: "Coloring" },
              { day: 2, title: "Waarom vasten we?", type: "Maze" },
              { day: 3, title: "Suhoor", type: "Coloring" },
            ].map((d, i) => (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>DAY {d.day}</span>
                  <span className="text-xs text-white/40">{d.type}</span>
                </div>
                <p className="font-medium">{d.title}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/30 text-sm mt-4">+ 27 more days of Islamic activities...</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">What Families Say</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { quote: "My daughter asks every morning: what's today's activity?", name: "Fatima", city: "Rotterdam" },
              { quote: "Finally something Islamic for my son's age!", name: "Ahmed", city: "Brussels" },
              { quote: "We printed every sheet, now it's a Ramadan memory book!", name: "Sara", city: "Amsterdam" },
            ].map((t, i) => (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex gap-1 mb-2 text-sm" style={{ color: "#f5c842" }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="text-sm text-white/80 italic mb-2">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs text-white/40">{t.name}, {t.city}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
          {[
            { q: "When do activities unlock?", a: "One new activity unlocks each day of Ramadan at midnight local time. If you join late, all past days are immediately available for catch-up." },
            { q: "Can I print the worksheets?", a: "Yes! Every activity generates a printable A4 PDF. You can also color digitally on any device." },
            { q: "What age is this for?", a: "Activities are designed for children aged 4-8, with varying difficulty." },
            { q: "Multiple children?", a: "One purchase covers your whole family. No per-child fees." },
            { q: "What if I already have a Pro subscription?", a: "The Ramadan Challenge is a separate product with unique daily content not available in the regular worksheet library." },
          ].map((f, i) => (
            <details key={i} className="group border-b border-white/10 py-4">
              <summary className="flex justify-between items-center cursor-pointer font-medium">
                {f.q}
                <span className="text-white/40 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm text-white/60">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 text-center">
        <div className="text-5xl mb-4">&#127769;&#11088;</div>
        <h2 className="text-3xl font-extrabold mb-4">Give Your Kids a Ramadan They&apos;ll Remember</h2>
        <button onClick={handleEnroll} disabled={enrolling}
          className="px-10 py-4 rounded-xl font-bold text-lg" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
          Join the Challenge — {price}
        </button>
        <p className="text-white/30 text-xs mt-3">30 daily activities &middot; Badges &amp; certificate &middot; Whole family access</p>
      </section>

      <footer className="text-center py-6 text-xs text-white/20 border-t border-white/5">
        Noor Printables &copy; 2026 &mdash; 30 Days of Ramadan Challenge
      </footer>
    </div>
  );
}
