"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError(t("invalidCredentials"));
    else { router.push("/account"); router.refresh(); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-border p-8">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold tracking-[0.15em] uppercase font-[family-name:var(--font-heading)] text-emerald">Layali</Link>
            <p className="mt-2 text-muted-foreground">{t("loginTitle")}</p>
          </div>
          {error && <div className="mb-6 p-3 rounded-lg bg-red-50 text-destructive text-sm text-center">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t("email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label={t("password")} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="w-full" size="lg" loading={loading}>{t("loginButton")}</Button>
          </form>
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-border" /><span className="text-xs text-muted-foreground">{t("or")}</span><div className="flex-1 border-t border-border" />
          </div>
          <Button variant="outline" className="w-full" size="lg" onClick={() => signIn("google", { callbackUrl: "/account" })}>
            {t("googleButton")}
          </Button>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-foreground hover:underline">{t("registerButton")}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
