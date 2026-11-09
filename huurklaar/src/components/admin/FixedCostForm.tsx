"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function FixedCostForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("software");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [state, setState] = useState<"idle" | "busy" | "fail">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const r = await fetch("/api/admin/costs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), category, monthly_eur: Number(amount.replace(",", ".")), starts_on: start }),
    }).catch(() => null);
    if (r?.ok) { setName(""); setAmount(""); setState("idle"); router.refresh(); } else setState("fail");
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
      <h3>Vaste kost toevoegen</h3>
      <div className="row">
        <label className="field" htmlFor="fc-name">Naam<input id="fc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="bv. Vercel Pro" /></label>
        <label className="field" htmlFor="fc-cat">Categorie
          <select id="fc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="hosting">Hosting</option><option value="software">Software</option><option value="marketing">Marketing</option>
            <option value="diensten">Diensten</option><option value="andere">Andere</option>
          </select>
        </label>
        <label className="field" htmlFor="fc-amt">Per maand (€, excl. btw)<input id="fc-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required pattern="[0-9]+([.,][0-9]{1,2})?" /></label>
        <label className="field" htmlFor="fc-start">Vanaf<input id="fc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
      </div>
      <button className="btn btn-primary" type="submit" disabled={state === "busy"} style={{ justifySelf: "start" }}>Toevoegen</button>
      {state === "fail" && <p className="error" role="alert">Opslaan lukte niet. Controleer de velden.</p>}
    </form>
  );
}
