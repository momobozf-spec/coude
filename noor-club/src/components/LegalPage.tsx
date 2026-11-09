import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routing } from "@/routing";

/**
 * Shell for the legal pages.
 *
 * The bodies are intentionally empty with TODO markers in the source: a privacy
 * policy and terms of sale are legal instruments, and plausible-sounding
 * boilerplate is worse than an obvious blank — it looks finished, so nobody
 * replaces it.
 */
export async function LegalPage({
  locale,
  title,
  children,
}: {
  locale: string;
  title: string;
  children?: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold text-emerald-dark sm:text-4xl">{title}</h1>

      <p className="mt-6 rounded-card border-2 border-dashed border-gold bg-gold-light p-5 text-sm font-semibold leading-relaxed text-slate-700">
        {t("draftNotice")}
      </p>

      <div className="prose mt-8 text-slate-700">{children}</div>
    </article>
  );
}

export async function legalMetadata(
  locale: string,
  kind: "privacy" | "terms",
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "legal" });
  const title = kind === "privacy" ? t("privacyTitle") : t("termsTitle");
  const path = kind === "privacy" ? "privacy" : "voorwaarden";

  return {
    title,
    // Not useful in search results, and they change without notice.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: Object.fromEntries(
        routing.locales.map((code) => [code, `/${code}/${path}`]),
      ),
    },
  };
}
