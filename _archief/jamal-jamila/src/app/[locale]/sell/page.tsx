import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Users, TrendingUp, Sparkles, HeartHandshake } from "lucide-react";
import { brand } from "@/lib/brand";
import SellerForm from "@/components/seller/SellerForm";

export const metadata: Metadata = {
  title: "Word verkoper",
  description: "Sluit je aan bij een zorgvuldig samengestelde marketplace voor oriental lifestyle, cadeaus en beleving.",
  alternates: { canonical: `${brand.url}/sell` },
};

export default async function SellPage() {
  const t = await getTranslations("sell");

  const benefits = [
    { icon: Users, title: t("benefit1Title"), desc: t("benefit1Desc") },
    { icon: TrendingUp, title: t("benefit2Title"), desc: t("benefit2Desc") },
    { icon: Sparkles, title: t("benefit3Title"), desc: t("benefit3Desc") },
    { icon: HeartHandshake, title: t("benefit4Title"), desc: t("benefit4Desc") },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-white">
        <div className="absolute inset-0 pattern-oriental opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{t("eyebrow")}</span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t("title")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">{t("subtitle")}</p>
          <a href="#aanmelden" className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-secondary transition-colors hover:bg-gold/90">
            {t("heroCta")}
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sage/30">
                <b.icon className="h-5 w-5 text-emerald" />
              </div>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{t("stepsTitle")}</h2>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald text-lg font-bold text-white">{n}</div>
                <h3 className="mt-4 font-semibold">{t(`step${n}Title`)}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`step${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="aanmelden" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("formTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("trustCopy")}</p>
        </div>
        <SellerForm />
      </section>
    </div>
  );
}
