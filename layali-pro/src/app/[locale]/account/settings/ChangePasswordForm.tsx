"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ChangePasswordForm() {
  const t = useTranslations("auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next !== confirm) return setMessage({ ok: false, text: t("passwordMismatch") });
    if (next.length < 10) return setMessage({ ok: false, text: t("passwordTooShort") });
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: t("changeDone") });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setMessage({ ok: false, text: (await res.json().catch(() => ({}))).error ?? t("genericError") });
      }
    } catch {
      setMessage({ ok: false, text: t("genericError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.ok ? "bg-emerald/10 text-emerald" : "bg-red-50 text-destructive"}`}>{message.text}</div>
      )}
      <Input label={t("currentPassword")} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Input label={t("newPassword")} type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input label={t("confirmPassword")} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" loading={loading}>{t("changeButton")}</Button>
    </form>
  );
}
