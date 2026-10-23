"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (res.ok) setSent(true);
      else setError((await res.json().catch(() => ({}))).error ?? t("genericError"));
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-border p-8">
        <h1 className="text-2xl font-bold mb-2 font-[family-name:var(--font-heading)]">{t("forgotTitle")}</h1>
        {sent ? (
          <p className="text-muted-foreground">{t("forgotSent")}</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">{t("forgotIntro")}</p>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-destructive text-sm">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <Input label={t("email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" className="w-full" size="lg" loading={loading}>{t("forgotButton")}</Button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium hover:underline">{t("backToLogin")}</Link>
        </p>
      </div>
    </div>
  );
}
