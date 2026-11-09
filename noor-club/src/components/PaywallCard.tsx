import { getTranslations } from "next-intl/server";
import { CheckoutButton } from "@/components/CheckoutButton";

/** Rendered instead of a pack's contents when the parent has no subscription. */
export async function PaywallCard({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "paywall" });

  const bullets = [t("bullet1"), t("bullet2"), t("bullet3")];

  return (
    <div className="rounded-card border-2 border-gold bg-gold-light p-6 sm:p-8">
      <p className="text-4xl" aria-hidden="true">
        🔒
      </p>
      <h2 className="mt-2 text-2xl font-extrabold text-emerald-dark">{t("title")}</h2>
      <p className="mt-2 max-w-xl text-slate-700">{t("body")}</p>

      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="font-bold text-emerald" aria-hidden="true">
              ✓
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <CheckoutButton locale={locale} label={t("cta")} />
      </div>

      <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-700">
        {t("note")}
      </p>
    </div>
  );
}

export async function UnreleasedCard({
  locale,
  releaseAt,
}: {
  locale: string;
  releaseAt: Date;
}) {
  const t = await getTranslations({ locale, namespace: "paywall" });

  return (
    <div className="rounded-card border-2 border-dashed border-emerald-light bg-white p-6 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⏳
      </p>
      <h2 className="mt-2 text-xl font-extrabold text-emerald-dark">
        {t("unreleasedTitle")}
      </h2>
      <p className="mt-2 text-slate-600">
        {t("unreleasedBody", {
          date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(releaseAt),
        })}
      </p>
    </div>
  );
}
