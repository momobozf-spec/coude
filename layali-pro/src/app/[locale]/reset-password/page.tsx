"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function ResetForm() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? "" : t("resetInvalid"));
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError(t("passwordMismatch"));
    if (password.length < 10) return setError(t("passwordTooShort"));
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) setDone(true);
      else setError((await res.json().catch(() => ({}))).error ?? t("genericError"));
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        <p className="text-muted-foreground mb-6">{t("resetDone")}</p>
        <Link href="/login"><Button className="w-full" size="lg">{t("loginButton")}</Button></Link>
      </>
    );
  }
  return (
    <>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-destructive text-sm">{error}</div>}
      {token && (
        <form onSubmit={submit} className="space-y-4">
          <Input label={t("newPassword")} type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label={t("confirmPassword")} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" className="w-full" size="lg" loading={loading}>{t("resetButton")}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/forgot-password" className="font-medium hover:underline">{t("forgotTitle")}</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-border p-8">
        <h1 className="text-2xl font-bold mb-6 font-[family-name:var(--font-heading)]">{t("resetTitle")}</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
