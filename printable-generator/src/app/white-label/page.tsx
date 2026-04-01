"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { WL_PLANS } from "@/lib/wl-plans";

export default function WhiteLabelPage() {
  const { data: session } = useSession();
  const [purchasing, setPurchasing] = useState(false);
  const [demoBrand, setDemoBrand] = useState<"green" | "blue" | "purple">("green");

  async function handlePurchase(plan: string) {
    if (!session) { window.location.href = "/register"; return; }
    setPurchasing(true);
    const res = await fetch("/api/white-label/purchase", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setPurchasing(false);
  }

  const brandColors = { green: { primary: "#1a6b4a", name: "Al-Noor Academy" }, blue: { primary: "#1e40af", name: "Iqra International" }, purple: { primary: "#7c3aed", name: "Dar Al-Arqam" } };
  const current = brandColors[demoBrand];

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#1a6b4a" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <a href="#pricing" className="text-sm text-gray-500 hidden sm:inline">Pricing</a>
            {session ? <Link href="/dashboard" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>Dashboard</Link> : <Link href="/register" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>Start Free</Link>}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center" style={{ background: "linear-gradient(180deg, #faf9f5, #e8f5ec)" }}>
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-bold px-3 py-1 rounded-full mb-4 inline-block" style={{ backgroundColor: "#e8f5ec", color: "#1a6b4a" }}>WHITE LABEL FOR SCHOOLS</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Your School&apos;s Private
            <br /><span style={{ color: "#1a6b4a" }}>Islamic Learning Platform</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
            Brand it as your own. Your logo, your colors, your subdomain. All Islamic worksheets and activities under your school&apos;s name.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="#pricing" className="btn-primary text-lg px-8 py-3" style={{ backgroundColor: "#1a6b4a" }}>See Plans</a>
            <a href="#demo" className="btn-secondary text-lg px-8 py-3">See Demo &#8595;</a>
          </div>
        </div>
      </section>

      {/* Live demo switcher */}
      <section className="px-4 py-16 bg-white" id="demo">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">See It With Your Branding</h2>
          <p className="text-gray-500 mb-6">Switch between schools to see how your platform would look</p>

          <div className="flex gap-2 justify-center mb-8">
            {(["green", "blue", "purple"] as const).map(b => (
              <button key={b} onClick={() => setDemoBrand(b)} className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: demoBrand === b ? brandColors[b].primary : "#f3f4f6", color: demoBrand === b ? "#fff" : "#666" }}>
                {brandColors[b].name}
              </button>
            ))}
          </div>

          {/* Simulated branded dashboard */}
          <div className="card max-w-2xl mx-auto overflow-hidden" style={{ borderColor: current.primary, borderWidth: 2 }}>
            <div className="py-3 px-4 flex items-center justify-between" style={{ backgroundColor: current.primary }}>
              <span className="text-white font-bold">{current.name}</span>
              <span className="text-white/60 text-xs">Powered by Noor Printables</span>
            </div>
            <div className="p-6 text-left">
              <p className="text-gray-500 text-sm mb-3">Welcome to {current.name}&apos;s Learning Portal</p>
              <div className="grid grid-cols-3 gap-3">
                {["Coloring Pages", "Mazes", "Word Search"].map(t => (
                  <div key={t} className="p-3 rounded-lg text-center text-sm" style={{ backgroundColor: `${current.primary}10`, color: current.primary }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For who */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Built For</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "&#127979;", name: "Islamic Primary Schools" },
              { icon: "&#128214;", name: "Weekend Islamic Schools" },
              { icon: "&#128332;", name: "Mosque Education Programs" },
              { icon: "&#127968;", name: "Islamic Homeschool Co-ops" },
            ].map((t, i) => (
              <div key={i} className="card text-center">
                <div className="text-3xl mb-2" dangerouslySetInnerHTML={{ __html: t.icon }} />
                <p className="text-sm font-medium text-gray-700">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16 bg-white" id="pricing">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Simple Annual Pricing</h2>
          <p className="text-center text-gray-500 mb-10">One payment, one year of your own branded platform</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(Object.entries(WL_PLANS) as [string, typeof WL_PLANS.basic][]).map(([key, plan]) => (
              <div key={key} className="card" style={key === "advanced" ? { borderColor: "#c9920a", borderWidth: 2 } : {}}>
                {key === "advanced" && <div className="text-xs font-bold text-center mb-2" style={{ color: "#c9920a" }}>RECOMMENDED</div>}
                <h3 className="text-xl font-bold text-center">{plan.name}</h3>
                <div className="text-center my-4">
                  <span className="text-4xl font-extrabold">${plan.price}</span>
                  <span className="text-gray-400">/year</span>
                </div>
                <p className="text-center text-sm text-gray-500 mb-6">{plan.seats} teacher seats</p>
                <button onClick={() => handlePurchase(key)} disabled={purchasing}
                  className="btn-primary w-full py-3 mb-4" style={{ backgroundColor: key === "advanced" ? "#c9920a" : "#1a6b4a" }}>
                  {purchasing ? "..." : `Get ${plan.name}`}
                </button>
                <ul className="text-sm space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-600"><span style={{ color: "#1a6b4a" }}>&#10003;</span>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">All plans include: setup wizard, teacher management, custom subdomain, PDF branding</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center" style={{ background: "linear-gradient(135deg, #1a6b4a, #145239)" }}>
        <h2 className="text-3xl font-extrabold text-white mb-4">Give Your School Its Own Islamic Learning Platform</h2>
        <p className="text-green-100 mb-6">Join 180+ Islamic schools already using Noor Printables</p>
        <a href="#pricing" className="inline-block px-10 py-4 rounded-lg font-bold text-lg bg-white" style={{ color: "#1a6b4a" }}>
          Get Started &rarr;
        </a>
      </section>

      <footer className="text-center py-6 text-sm text-gray-400">Noor Printables &copy; 2026</footer>
    </div>
  );
}
