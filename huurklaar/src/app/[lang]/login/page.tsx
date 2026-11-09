import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getDict, isLocale } from "@/lib/i18n";
import { safeRedirectPath } from "@/lib/security";

export default async function Login({
  params, searchParams,
}: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { next, error } = await searchParams;
  const t = getDict(lang);
  const safeNext = safeRedirectPath(next, `/${lang}/dossier`);
  return (
    <div style={{ maxWidth: 480, display: "grid", gap: 16 }}>
      <h1>{t.l.h}</h1>
      <p className="lead">{t.l.lead}</p>
      {error && <p className="error" role="alert">{t.l.fail}</p>}
      <LoginForm t={t.l} next={safeNext} lang={lang} />
    </div>
  );
}
