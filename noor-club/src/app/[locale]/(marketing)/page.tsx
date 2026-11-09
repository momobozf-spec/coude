import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Chip } from "@/components/ui/StatTile";

export const dynamic = "force-dynamic";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // A signed-in parent has no use for the sales page. Note this also resolves
  // the route collision between the marketing "/" and the app's child picker,
  // which now lives at "/kinderen".
  const session = await auth();
  if (session?.user?.id) redirect(`/${locale}/kinderen`);

  const t = await getTranslations({ locale, namespace: "marketing" });

  const steps = [
    { title: t("how.step1Title"), body: t("how.step1Body"), icon: "📦" },
    { title: t("how.step2Title"), body: t("how.step2Body"), icon: "🖨️" },
    { title: t("how.step3Title"), body: t("how.step3Body"), icon: "🌟" },
  ];

  const inside = [
    { title: t("inside.worksheets"), body: t("inside.worksheetsBody"), icon: "📝" },
    { title: t("inside.story"), body: t("inside.storyBody"), icon: "📖" },
    { title: t("inside.guide"), body: t("inside.guideBody"), icon: "🧭" },
    { title: t("inside.games"), body: t("inside.gamesBody"), icon: "🎲" },
    { title: t("inside.passport"), body: t("inside.passportBody"), icon: "🏅" },
  ];

  const engines = [
    t("engines.match"),
    t("engines.sequence"),
    t("engines.quiz"),
    t("engines.listen"),
    t("engines.wordbuild"),
  ];

  const bullets = [
    t("pricing.bullet1"),
    t("pricing.bullet2"),
    t("pricing.bullet3"),
    t("pricing.bullet4"),
  ];

  const faq = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  return (
    <>
      <section className="bg-emerald-light/60">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
          <Chip tone="gold">{t("hero.badge")}</Chip>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-emerald-dark sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
            {t("hero.subtitle")}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonClasses("primary", "lg")}>
              {t("hero.cta")}
            </Link>
            <Link href="/register" className={buttonClasses("secondary", "lg")}>
              {t("hero.secondaryCta")}
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-600">{t("hero.note")}</p>
          <p className="mt-1 text-sm font-bold text-emerald-dark">{t("ages")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-extrabold text-emerald-dark sm:text-3xl">
          {t("how.title")}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card">
              <span className="text-3xl" aria-hidden="true">
                {step.icon}
              </span>
              <h3 className="mt-2 font-extrabold text-emerald-dark">
                {index + 1}. {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-emerald-light/40">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-extrabold text-emerald-dark sm:text-3xl">
            {t("inside.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-slate-700">{t("inside.subtitle")}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inside.map((item) => (
              <div key={item.title} className="card">
                <span className="text-3xl" aria-hidden="true">
                  {item.icon}
                </span>
                <h3 className="mt-2 font-extrabold text-emerald-dark">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-extrabold text-emerald-dark sm:text-3xl">
          {t("engines.title")}
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {engines.map((engine) => (
            <li
              key={engine}
              className="flex items-start gap-3 rounded-card bg-white p-4 shadow-card"
            >
              <span className="text-xl" aria-hidden="true">
                ▸
              </span>
              <span className="text-sm leading-relaxed text-slate-700">{engine}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="prijs" className="bg-emerald text-white">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("pricing.title")}</h2>
          <p className="mt-2 text-emerald-light">{t("pricing.subtitle")}</p>

          <div className="mt-6 rounded-card bg-white p-6 text-slate-800 shadow-lift sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wide text-gold">
              {t("pricing.firstMonth")}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-emerald-dark sm:text-5xl">
                {t("pricing.price")}
              </span>
              <span className="text-slate-600">{t("pricing.period")}</span>
            </p>

            <ul className="mt-5 space-y-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="font-bold text-emerald" aria-hidden="true">
                    ✓
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className={buttonClasses("gold", "lg", "mt-6 w-full sm:w-auto")}
            >
              {t("pricing.cta")}
            </Link>

            {/* Legally and commercially load-bearing: shown before the button,
                not after, and never behind a disclosure toggle. */}
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-700">
              {t("pricing.disclaimer")}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t("pricing.guarantee")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-extrabold text-emerald-dark sm:text-3xl">
          {t("faq.title")}
        </h2>
        <div className="mt-6 space-y-3">
          {faq.map((item) => (
            <details key={item.q} className="card group">
              <summary className="cursor-pointer list-none font-bold text-emerald-dark marker:hidden">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
