"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhiteLabelSetup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    schoolName: "", schoolNameAr: "", country: "", city: "", studentCount: 0,
    subdomain: "", plan: "basic",
    logoUrl: "", primaryColor: "#1a6b4a", secondaryColor: "#c9920a",
    welcomeMessage: "", teacherEmails: [] as string[], emailsText: "",
  });

  function update(field: string, value: unknown) { setForm(f => ({ ...f, [field]: value })); }

  async function checkSubdomain(sub: string) {
    if (sub.length < 3) { setSubdomainAvailable(null); return; }
    const res = await fetch(`/api/white-label/check-subdomain?subdomain=${sub}`);
    const data = await res.json();
    setSubdomainAvailable(data.available);
  }

  async function handleComplete() {
    setLoading(true);
    const teacherEmails = form.emailsText.split("\n").map(e => e.trim()).filter(Boolean);
    const res = await fetch("/api/white-label/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, teacherEmails }),
    });
    const data = await res.json();
    if (data.success) setStep(7); // done
    setLoading(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#1a6b4a" }}>White Label Setup</span>
          <span className="text-sm text-gray-400">Step {Math.min(step, 6)} of 6</span>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4, 5, 6].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s <= step ? "#1a6b4a" : "#e5e7eb" }} />
          ))}
        </div>

        {/* Step 1: School Info */}
        {step === 1 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#127979; School Information</h2>
            <input type="text" className="input-field mb-3" placeholder="School name (English)" value={form.schoolName} onChange={e => update("schoolName", e.target.value)} />
            <input type="text" className="input-field mb-3" placeholder="School name (Arabic, optional)" value={form.schoolNameAr} onChange={e => update("schoolNameAr", e.target.value)} />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" className="input-field" placeholder="Country" value={form.country} onChange={e => update("country", e.target.value)} />
              <input type="text" className="input-field" placeholder="City" value={form.city} onChange={e => update("city", e.target.value)} />
            </div>
            <input type="number" className="input-field mb-4" placeholder="Number of students" value={form.studentCount || ""} onChange={e => update("studentCount", parseInt(e.target.value) || 0)} />
            <button onClick={() => setStep(2)} disabled={!form.schoolName} className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>Next &rarr;</button>
          </div>
        )}

        {/* Step 2: Subdomain */}
        {step === 2 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#127760; Choose Your Subdomain</h2>
            <div className="flex items-center gap-0 mb-2">
              <input type="text" className="input-field rounded-r-none" placeholder="your-school"
                value={form.subdomain} onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); update("subdomain", v); checkSubdomain(v); }} />
              <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-500 whitespace-nowrap">.noorprintables.com</span>
            </div>
            {subdomainAvailable === true && <p className="text-sm mb-4" style={{ color: "#1a6b4a" }}>&#10003; Available!</p>}
            {subdomainAvailable === false && <p className="text-sm text-red-500 mb-4">&#10007; Taken. Try another.</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(3)} disabled={!subdomainAvailable} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 3: Branding */}
        {step === 3 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#127912; Upload Branding</h2>
            <label className="text-sm font-medium text-gray-700 block mb-1">Logo URL (PNG)</label>
            <input type="text" className="input-field mb-3" placeholder="https://..." value={form.logoUrl} onChange={e => update("logoUrl", e.target.value)} />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Primary Color</label>
                <input type="color" value={form.primaryColor} onChange={e => update("primaryColor", e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Secondary Color</label>
                <input type="color" value={form.secondaryColor} onChange={e => update("secondaryColor", e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
              </div>
            </div>
            {/* Preview */}
            <div className="rounded-lg overflow-hidden mb-4 border">
              <div className="py-2 px-3 text-white text-sm font-bold" style={{ backgroundColor: form.primaryColor }}>
                {form.schoolName || "Your School"}
              </div>
              <div className="p-3 text-xs text-gray-400">Powered by Noor Printables</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(4)} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 4: Welcome Message */}
        {step === 4 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#128172; Welcome Message</h2>
            <textarea className="input-field mb-4" style={{ minHeight: 100 }} placeholder="Welcome to our school's learning platform! Use these Islamic worksheets for your classes."
              value={form.welcomeMessage} onChange={e => update("welcomeMessage", e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(5)} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>Next &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 5: Invite Teachers */}
        {step === 5 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#128231; Invite Teachers</h2>
            <p className="text-sm text-gray-500 mb-3">Enter teacher emails, one per line. You can also invite later.</p>
            <textarea className="input-field mb-4" style={{ minHeight: 120 }} placeholder={"teacher1@school.com\nteacher2@school.com"}
              value={form.emailsText} onChange={e => update("emailsText", e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setStep(4)} className="btn-outline flex-1">Back</button>
              <button onClick={() => setStep(6)} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>
                {form.emailsText.trim() ? "Next →" : "Skip & Finish →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Confirm */}
        {step === 6 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">&#10003; Review & Launch</h2>
            <div className="space-y-2 text-sm mb-6">
              <p><strong>School:</strong> {form.schoolName}</p>
              <p><strong>Subdomain:</strong> {form.subdomain}.noorprintables.com</p>
              <p><strong>Plan:</strong> {form.plan}</p>
              <p><strong>Teachers to invite:</strong> {form.emailsText.split("\n").filter(Boolean).length}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(5)} className="btn-outline flex-1">Back</button>
              <button onClick={handleComplete} disabled={loading} className="btn-primary flex-1" style={{ backgroundColor: "#1a6b4a" }}>
                {loading ? "Creating..." : "Launch Platform"}
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Done! */}
        {step === 7 && (
          <div className="card text-center">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "#1a6b4a" }}>Your Platform is Ready!</h2>
            <p className="text-gray-500 mb-6">{form.schoolName}&apos;s learning portal is live.</p>
            <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: "#e8f5ec" }}>
              <p className="text-sm text-gray-600 mb-1">Your URL:</p>
              <p className="text-lg font-bold" style={{ color: "#1a6b4a" }}>{form.subdomain}.noorprintables.com</p>
            </div>
            <a href={`https://${form.subdomain}.noorprintables.com`} target="_blank" className="btn-primary w-full mb-3" style={{ backgroundColor: "#1a6b4a", display: "block", textAlign: "center", padding: "12px" }}>
              Visit Your Platform &rarr;
            </a>
            <a href="/school/teachers" className="text-sm hover:underline" style={{ color: "#1a6b4a" }}>Manage Teachers &rarr;</a>
          </div>
        )}
      </div>
    </div>
  );
}
