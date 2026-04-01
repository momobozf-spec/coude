"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BOOK_VARIANTS, BookVariant } from "@/lib/printful";

const COVER_STYLES = [
  { id: "classic", name: "Classic Green", color: "#1a6b4a" },
  { id: "ramadan", name: "Ramadan Night", color: "#0f172a" },
  { id: "eid", name: "Eid Gold", color: "#c9920a" },
  { id: "arabic", name: "Arabic Blue", color: "#1e40af" },
];

export default function CreateBookPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "My Islamic Coloring Book",
    childName: "",
    childAge: 6,
    variant: "softcover_20" as BookVariant,
    coverStyle: "classic",
    coverColor: "#1a6b4a",
    dedicationText: "",
    language: "EN",
    worksheetIds: [] as string[],
  });

  // Mock worksheet IDs for demo
  const mockWorksheets = Array.from({ length: 20 }, (_, i) => ({
    id: `ws-${i + 1}`,
    title: ["Mosque", "Crescent", "Lantern", "Kaaba", "Quran", "Dua Hands", "Arabic Letters", "Eid Gifts", "Ramadan Moon", "Geometric Pattern", "Minaret", "Iftar Table", "Family Prayer", "Nature", "Kindness", "Zakat", "Hajj", "Patience", "Gratitude", "Wudu"][i],
    selected: i < 15,
  }));

  function update(field: string, value: unknown) { setForm(f => ({ ...f, [field]: value })); }

  const selectedIds = mockWorksheets.filter(w => w.selected).map(w => w.id);
  const variant = BOOK_VARIANTS[form.variant];
  const coverStyle = COVER_STYLES.find(s => s.id === form.coverStyle) || COVER_STYLES[0];

  async function handleCreate() {
    if (!form.childName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, worksheetIds: selectedIds }),
      });
      const data = await res.json();
      if (data.bookId) router.push(`/books/my-books`);
    } catch { /* */ }
    setCreating(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/books" className="text-sm text-gray-500">&larr; Books</Link>
          <span className="font-bold" style={{ color: "#1a6b4a" }}>Create Book</span>
          <span className="text-sm text-gray-400">Step {step}/4</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4].map(s => <div key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s <= step ? "#1a6b4a" : "#e5e7eb" }} />)}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main form */}
          <div className="flex-1">
            {step === 1 && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">&#128118; Personalize</h2>
                <label className="text-sm font-medium text-gray-700 block mb-1">Child&apos;s Name</label>
                <input type="text" className="input-field mb-3" placeholder="e.g. Aisha" value={form.childName} onChange={e => update("childName", e.target.value)} />
                <label className="text-sm font-medium text-gray-700 block mb-1">Book Title</label>
                <input type="text" className="input-field mb-3" value={form.title} onChange={e => update("title", e.target.value)} />
                <label className="text-sm font-medium text-gray-700 block mb-1">Dedication (optional)</label>
                <textarea className="input-field mb-4" placeholder="For my little star..." value={form.dedicationText} onChange={e => update("dedicationText", e.target.value)} style={{ minHeight: 80 }} />
                <button onClick={() => setStep(2)} disabled={!form.childName.trim()} className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>Next: Choose Cover &rarr;</button>
              </div>
            )}

            {step === 2 && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">&#127912; Cover Design</h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {COVER_STYLES.map(s => (
                    <button key={s.id} onClick={() => { update("coverStyle", s.id); update("coverColor", s.color); }}
                      className="p-3 rounded-lg text-center text-sm font-medium text-white"
                      style={{ backgroundColor: s.color, border: form.coverStyle === s.id ? "3px solid #333" : "3px solid transparent" }}>
                      {s.name}
                    </button>
                  ))}
                </div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Book Type</label>
                <select className="input-field mb-4" value={form.variant} onChange={e => update("variant", e.target.value)}>
                  {Object.entries(BOOK_VARIANTS).map(([k, v]) => <option key={k} value={k}>{v.label} — &euro;{v.priceEur}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="btn-outline flex-1">Back</button>
                  <button onClick={() => setStep(3)} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next: Select Pages &rarr;</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="card">
                <h2 className="text-lg font-bold mb-2">&#128196; Select Worksheets</h2>
                <p className="text-xs text-gray-500 mb-4">{selectedIds.length} pages selected (min 10, max {variant.pages})</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {mockWorksheets.map(w => (
                    <div key={w.id} className="text-center p-2 rounded-lg cursor-pointer text-xs" style={{
                      backgroundColor: w.selected ? "#e8f5ec" : "#f3f4f6",
                      border: w.selected ? "2px solid #1a6b4a" : "2px solid transparent",
                    }}>
                      <div className="text-xl mb-1">&#127912;</div>
                      <p className="truncate">{w.title}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="btn-outline flex-1">Back</button>
                  <button onClick={() => setStep(4)} disabled={selectedIds.length < 10} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>
                    Next: Review &rarr;
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">&#10003; Review Your Book</h2>
                <div className="space-y-2 text-sm mb-4">
                  <p><strong>Title:</strong> {form.title}</p>
                  <p><strong>Child:</strong> {form.childName}{form.childAge ? `, age ${form.childAge}` : ""}</p>
                  <p><strong>Pages:</strong> {selectedIds.length}</p>
                  <p><strong>Type:</strong> {variant.label}</p>
                  <p><strong>Cover:</strong> {coverStyle.name}</p>
                  {form.dedicationText && <p><strong>Dedication:</strong> {form.dedicationText.slice(0, 50)}...</p>}
                </div>
                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: "#e8f5ec" }}>
                  <p className="text-sm font-bold" style={{ color: "#1a6b4a" }}>Book: &euro;{variant.priceEur}</p>
                  <p className="text-xs text-gray-500">+ shipping from &euro;4.99</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(3)} className="btn-outline flex-1">Back</button>
                  <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>
                    {creating ? "Creating..." : "Save & Proceed to Order"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview sidebar */}
          <div className="lg:w-64">
            <div className="sticky top-20">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cover Preview</p>
              <div className="aspect-square rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: form.coverColor || coverStyle.color }}>
                <div className="h-full flex flex-col items-center justify-center text-white p-6 text-center">
                  <div className="text-3xl mb-2">&#127769;</div>
                  <p className="font-bold text-sm">{form.title || "Your Book"}</p>
                  <p className="text-xs mt-1 opacity-80">{form.childName || "Child's Name"}&apos;s</p>
                  <p className="text-[10px] mt-auto opacity-50">NoorPrintables.com</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">{variant.size}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
