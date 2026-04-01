"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SocialLoginButtons from "@/components/SocialLoginButtons";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ref = searchParams.get("ref");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, ref }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("error.generic"));
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          {t("auth.register.title")}
        </h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Social Login */}
        <SocialLoginButtons />

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase">{t("auth.divider")}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.register.name")}
            </label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              placeholder={t("auth.placeholder.name")}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.login.email")}
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t("auth.placeholder.email")}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.login.password")}
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={t("auth.placeholder.password")}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t("auth.register.loading") : t("auth.register.submit")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {t("auth.register.hasAccount")}{" "}
          <Link href="/login" className="hover:underline" style={{ color: "#0d9488" }}>
            {t("auth.register.loginLink")}
          </Link>
        </p>

        {ref && (
          <p className="mt-2 text-center text-xs" style={{ color: "#0d9488" }}>
            You were referred by a friend! You both get bonus sheets.
          </p>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <RegisterForm />
    </Suspense>
  );
}
