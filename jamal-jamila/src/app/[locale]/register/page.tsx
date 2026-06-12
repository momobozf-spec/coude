"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError(t("passwordMismatch")); return; }
    if (form.password.length < 8) { setError(t("passwordTooShort")); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, password: form.password }) });
      if (!res.ok) { const data = await res.json(); setError(data.error || "Error"); setLoading(false); return; }
      const signInRes = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      if (signInRes?.ok) { router.push("/account"); router.refresh(); }
    } catch { setError("Error"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-border p-8">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold tracking-[0.15em] uppercase font-[family-name:var(--font-heading)] text-emerald">Layali</Link>
            <p className="mt-2 text-muted-foreground">{t("registerTitle")}</p>
          </div>
          {error && <div className="mb-6 p-3 rounded-lg bg-red-50 text-destructive text-sm text-center">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t("name")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={t("email")} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label={t("password")} type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input label={t("confirmPassword")} type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
            <Button type="submit" className="w-full" size="lg" loading={loading}>{t("registerButton")}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href="/login" className="font-medium text-foreground hover:underline">{t("loginButton")}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
