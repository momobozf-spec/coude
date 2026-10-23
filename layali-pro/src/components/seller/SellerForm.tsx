"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SellerForm() {
  const t = useTranslations("sell");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    offerType: "PRODUCTS",
    category: "",
    description: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("error"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-3xl border border-border bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10">
          <CheckCircle className="h-8 w-8 text-emerald" />
        </div>
        <h3 className="text-xl font-bold">{t("successTitle")}</h3>
        <p className="mt-2 text-muted-foreground">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label={t("businessName")} required value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
        <Input label={t("contactName")} required value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        <Input label={t("email")} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Input label={t("phone")} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("offerType")}</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: "PRODUCTS", l: t("offerProducts") },
            { v: "SERVICES", l: t("offerServices") },
            { v: "BOTH", l: t("offerBoth") },
          ].map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => set("offerType", o.v)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${form.offerType === o.v ? "border-emerald bg-emerald/5 text-emerald" : "border-border text-muted-foreground hover:border-emerald/50"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <Input label={t("category")} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={t("categoryPlaceholder")} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("description")}</label>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          className="flex w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" loading={loading} className="w-full sm:w-auto">
        {t("submit")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("formNote")}</p>
    </form>
  );
}
