"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, MapPin, Clock } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ContactPage() {
  const t = useTranslations("common");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("contact")}</h1>
        <p className="mt-3 text-muted-foreground">Neem contact met ons op. We helpen je graag!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact info */}
        <div className="space-y-6">
          {[
            { icon: Mail, label: "E-mail", value: "hello@layali.shop" },
            { icon: MapPin, label: "Adres", value: "Antwerpen, België" },
            { icon: Clock, label: "Openingstijden", value: "Ma-Vr: 9:00 - 17:00" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-4 p-6 rounded-2xl border border-border bg-white">
              <div className="h-10 w-10 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          {sent ? (
            <div className="rounded-2xl border border-border bg-white p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-emerald" />
              </div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] mb-2">Bericht verzonden!</h2>
              <p className="text-muted-foreground">We nemen zo snel mogelijk contact met je op.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-white p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Naam" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <Input label="Onderwerp" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bericht</label>
                <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>
              <Button type="submit" size="lg">Verstuur bericht</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
