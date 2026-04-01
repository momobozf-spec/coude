"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["Ramadan", "Arabic Letters", "Islamic Values", "Eid", "Quran", "Hadith", "General"];
const LANGUAGES = ["EN", "NL", "FR", "DE", "AR"];

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "Ramadan", ageRange: "4-8", languages: ["EN"],
    tags: "", price: 3.99, description: "", pageCount: 1,
  });

  function update(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleLang(lang: string) {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(lang) ? f.languages.filter(l => l !== lang) : [...f.languages, lang],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) router.push("/sell/dashboard");
    } catch { /* */ }
    setSubmitting(false);
  }

  const priceSuggestion = form.pageCount <= 5 ? "$1.99–3.99" : form.pageCount <= 15 ? "$3.99–7.99" : "$7.99–14.99";

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#1a6b4a" }}>Upload Worksheet</span>
          <span className="text-sm text-gray-400">Step {step} of 4</span>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s <= step ? "#1a6b4a" : "#e5e7eb" }} />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Basic Information</h2>
            <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
            <input type="text" className="input-field mb-4" value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Ramadan Coloring Pack — 10 Pages" />

            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
            <select className="input-field mb-4" value={form.category} onChange={e => update("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <label className="text-sm font-medium text-gray-700 block mb-1">Age Range</label>
            <select className="input-field mb-4" value={form.ageRange} onChange={e => update("ageRange", e.target.value)}>
              {["4-5", "4-6", "4-8", "5-7", "6-8"].map(a => <option key={a}>{a}</option>)}
            </select>

            <label className="text-sm font-medium text-gray-700 block mb-1">Languages</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {LANGUAGES.map(l => (
                <button key={l} type="button" onClick={() => toggleLang(l)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={form.languages.includes(l) ? { backgroundColor: "#1a6b4a", color: "#fff" } : { backgroundColor: "#f3f4f6", color: "#666" }}>
                  {l}
                </button>
              ))}
            </div>

            <label className="text-sm font-medium text-gray-700 block mb-1">Tags (comma separated)</label>
            <input type="text" className="input-field mb-4" value={form.tags} onChange={e => update("tags", e.target.value)} placeholder="ramadan, coloring, mosque" />

            <button onClick={() => setStep(2)} disabled={!form.title} className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>
              Next: Pricing &rarr;
            </button>
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Pricing</h2>

            <label className="text-sm font-medium text-gray-700 block mb-1">Number of pages</label>
            <input type="number" className="input-field mb-2" min={1} max={100} value={form.pageCount} onChange={e => update("pageCount", parseInt(e.target.value))} />
            <p className="text-xs text-gray-400 mb-4">Suggested price for {form.pageCount} pages: {priceSuggestion}</p>

            <label className="text-sm font-medium text-gray-700 block mb-1">Price (USD)</label>
            <input type="number" className="input-field mb-2" min={0} max={24.99} step={0.01} value={form.price} onChange={e => update("price", parseFloat(e.target.value))} />
            <p className="text-xs text-gray-400 mb-4">Set to $0 for free. Min $1.99 for paid. You earn 70%: <strong style={{ color: "#1a6b4a" }}>${(form.price * 0.7).toFixed(2)}</strong></p>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next: Description &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Description</h2>
            <textarea className="input-field mb-4" style={{ minHeight: 150 }} value={form.description}
              onChange={e => update("description", e.target.value)}
              placeholder="Describe your worksheet pack: what's included, what kids will learn, special instructions..." />

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(4)} disabled={!form.description} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next: Review &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Review &amp; Submit</h2>

            <div className="space-y-2 text-sm mb-6">
              <p><strong>Title:</strong> {form.title}</p>
              <p><strong>Category:</strong> {form.category}</p>
              <p><strong>Age:</strong> {form.ageRange}</p>
              <p><strong>Languages:</strong> {form.languages.join(", ")}</p>
              <p><strong>Pages:</strong> {form.pageCount}</p>
              <p><strong>Price:</strong> {form.price === 0 ? "Free" : `$${form.price.toFixed(2)}`} (you earn ${(form.price * 0.7).toFixed(2)})</p>
            </div>

            <div className="p-3 rounded-lg text-xs text-gray-600 mb-4" style={{ backgroundColor: "#f0ebe3" }}>
              By submitting, you confirm this is original Islamic educational content and agree to the 70/30 commission split. Content will be reviewed within 48 hours.
            </div>

            <p className="text-xs text-gray-400 mb-4">&#128196; Note: Upload your PDF files after submission from the seller dashboard.</p>

            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="btn-outline flex-1">Back</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
