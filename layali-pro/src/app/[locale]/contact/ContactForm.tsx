"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setState("busy");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      setError((await res.json().catch(() => ({}))).error ?? "Je bericht kon niet verstuurd worden.");
    } catch {
      setError("Je bericht kon niet verstuurd worden.");
    }
    setState("idle");
  };

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-white p-12 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-emerald" />
        </div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] mb-2">Bericht verzonden!</h2>
        <p className="text-muted-foreground">We nemen zo snel mogelijk contact met je op.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-white p-6 space-y-4">
      {error && <div className="p-3 rounded-lg bg-red-50 text-destructive text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Naam" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <Input label="Onderwerp" required maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Bericht</label>
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
      <Button type="submit" size="lg" loading={state === "busy"}>Verstuur bericht</Button>
    </form>
  );
}
