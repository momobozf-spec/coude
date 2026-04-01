"use client";

import Link from "next/link";
import { useState } from "react";
import { Metadata } from "next";

export default function SellPage() {
  const [sheets, setSheets] = useState(20);
  const [price, setPrice] = useState(4.99);
  const earnings = Math.round(sheets * price * 0.7 * 100) / 100;

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#1a6b4a" }}>Noor Marketplace</Link>
          <Link href="/marketplace" className="text-sm text-gray-500">Browse</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center" style={{ background: "linear-gradient(180deg, #faf9f5, #e8f5ec)" }}>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
          Earn Money Sharing Your
          <br /><span style={{ color: "#1a6b4a" }}>Islamic Knowledge</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-6">
          Upload your Islamic worksheets and reach Muslim families worldwide. You keep 70% of every sale.
        </p>
        <Link href="/sell/dashboard" className="btn-primary text-lg px-10 py-3.5" style={{ backgroundColor: "#1a6b4a" }}>
          Start Selling Free &rarr;
        </Link>
        <p className="text-xs text-gray-400 mt-3">Free to list &middot; Only pay when you sell &middot; No monthly fees</p>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", icon: "&#128100;", title: "Create Seller Account", desc: "Free, takes 2 minutes" },
              { step: "2", icon: "&#128228;", title: "Upload Worksheets", desc: "PDF format, we handle the rest" },
              { step: "3", icon: "&#128176;", title: "Start Earning", desc: "70% commission on every sale" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#e8f5ec" }} dangerouslySetInnerHTML={{ __html: s.icon }} />
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings calculator */}
      <section className="px-4 py-16">
        <div className="max-w-md mx-auto card">
          <h2 className="text-lg font-bold text-center mb-6">Earnings Calculator</h2>
          <div className="mb-4">
            <label className="text-sm text-gray-600 flex justify-between"><span>Worksheets sold per month</span><strong>{sheets}</strong></label>
            <input type="range" min={1} max={100} value={sheets} onChange={e => setSheets(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div className="mb-6">
            <label className="text-sm text-gray-600 flex justify-between"><span>Average price</span><strong>${price.toFixed(2)}</strong></label>
            <input type="range" min={1.99} max={24.99} step={0.5} value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "#e8f5ec" }}>
            <p className="text-sm text-gray-600">Your monthly earnings</p>
            <p className="text-3xl font-extrabold" style={{ color: "#1a6b4a" }}>${earnings.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">After 30% platform fee</p>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="px-4 py-16 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Requirements</h2>
          <div className="space-y-3">
            {[
              "Islamic educational content appropriate for children aged 4-8",
              "PDF format, minimum 1 page",
              "Original work — not copied from others",
              "Content reviewed within 48 hours",
              "Minimum price $1.99 (or free)",
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span style={{ color: "#1a6b4a" }}>&#10003;</span>
                <p className="text-gray-600">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center" style={{ background: "linear-gradient(135deg, #1a6b4a, #145239)" }}>
        <h2 className="text-3xl font-extrabold text-white mb-4">Ready to Share Your Knowledge?</h2>
        <Link href="/sell/dashboard" className="inline-block px-10 py-4 rounded-lg font-bold text-lg bg-white" style={{ color: "#1a6b4a" }}>
          Start Selling Free &rarr;
        </Link>
      </section>
    </div>
  );
}
