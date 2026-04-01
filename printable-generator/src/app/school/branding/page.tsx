"use client";

import { useState, useEffect } from "react";

export default function SchoolBrandingPage() {
  const [form, setForm] = useState({ logoUrl: "", primaryColor: "#1a6b4a", secondaryColor: "#c9920a", schoolName: "", schoolNameAr: "", welcomeMessage: "", footerText: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Would fetch current branding from API
    setLoading(false);
  }, []);

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); setSaved(false); }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/white-label/branding", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#1a6b4a" }}>School Branding</span>
          <a href="/school/teachers" className="text-sm text-gray-500">Teachers</a>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Settings */}
        <div className="flex-1 space-y-4">
          <div className="card">
            <h3 className="font-bold mb-3">School Identity</h3>
            <input type="text" className="input-field mb-3" placeholder="School name" value={form.schoolName} onChange={e => update("schoolName", e.target.value)} />
            <input type="text" className="input-field mb-3" placeholder="School name (Arabic)" value={form.schoolNameAr} onChange={e => update("schoolNameAr", e.target.value)} />
            <input type="text" className="input-field" placeholder="Logo URL" value={form.logoUrl} onChange={e => update("logoUrl", e.target.value)} />
          </div>

          <div className="card">
            <h3 className="font-bold mb-3">Colors</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Primary</label>
                <input type="color" value={form.primaryColor} onChange={e => update("primaryColor", e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Secondary</label>
                <input type="color" value={form.secondaryColor} onChange={e => update("secondaryColor", e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold mb-3">Content</h3>
            <textarea className="input-field mb-3" placeholder="Welcome message for teachers" value={form.welcomeMessage} onChange={e => update("welcomeMessage", e.target.value)} />
            <input type="text" className="input-field" placeholder="Footer text" value={form.footerText} onChange={e => update("footerText", e.target.value)} />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3" style={{ backgroundColor: "#1a6b4a" }}>
            {saving ? "Saving..." : saved ? "&#10003; Saved!" : "Save & Apply"}
          </button>
        </div>

        {/* Live Preview */}
        <div className="lg:w-80">
          <div className="sticky top-20">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Live Preview</p>
            <div className="card overflow-hidden" style={{ borderColor: form.primaryColor, borderWidth: 2 }}>
              <div className="py-3 px-4 flex items-center gap-2" style={{ backgroundColor: form.primaryColor }}>
                {form.logoUrl && <img src={form.logoUrl} alt="" className="w-6 h-6 rounded" />}
                <span className="text-white font-bold text-sm">{form.schoolName || "Your School"}</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">{form.welcomeMessage || "Welcome to the learning portal"}</p>
                <div className="space-y-2">
                  {["Coloring Page", "Maze", "Word Search"].map(t => (
                    <div key={t} className="p-2 rounded text-xs" style={{ backgroundColor: `${form.primaryColor}15`, color: form.primaryColor }}>{t}</div>
                  ))}
                </div>
              </div>
              <div className="py-2 px-4 border-t text-xs text-gray-400">
                {form.footerText || `${form.schoolName || "School"} — Powered by Noor Printables`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
