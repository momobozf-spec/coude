import Link from "next/link";
import { localeFromParams, href } from "@/lib/locale";
import { getCategories, getActiveRegions } from "@/lib/catalog";
import { pick } from "@/i18n";
import { Card, LinkButton } from "@/components/ui";
import { HomeSearch } from "@/components/home-search";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const [cats, regions] = await Promise.all([getCategories(), getActiveRegions()]);
  const regionNames = regions.map((r) => pick(r, "name", locale)).join(", ");

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-10 pb-8 sm:pt-16 sm:pb-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t("home.question")}</h1>
          <p className="mt-3 text-muted">{t("app.tagline")}</p>
        </div>
        <div className="mx-auto mt-8 max-w-2xl">
          <HomeSearch
            locale={locale}
            categories={cats.map((c) => ({ slug: c.slug, name: pick(c, "name", locale) }))}
            labels={{
              placeholder: t("home.describe_placeholder"),
              postcode: t("home.postcode_label"),
              postcodePlaceholder: t("home.postcode_placeholder"),
              cta: t("home.cta"),
              describe: t("req.description_label"),
            }}
          />
          <p className="mt-3 text-center text-sm text-muted">
            <Link href={href(locale, "/zoeken")} className="underline decoration-line-strong underline-offset-4 hover:text-brand-strong">
              {t("home.or_browse")}
            </Link>
            {regionNames && <span className="block mt-1">{t("app.region_notice", { region: regionNames })}</span>}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-labelledby="how">
        <h2 id="how" className="sr-only">
          {t("home.how_title")}
        </h2>
        {[t("home.how_1"), t("home.how_2"), t("home.how_3")].map((s, i) => (
          <Card key={i} className="flex gap-4 items-start">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">
              {i + 1}
            </span>
            <p className="text-ink">{s}</p>
          </Card>
        ))}
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="text-lg font-bold">{t("home.trust_title")}</h2>
          <ul className="mt-3 space-y-2 text-ink">
            {[t("home.trust_pro"), t("home.trust_badges"), t("home.trust_reviews")].map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-brand" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="bg-brand-soft/60">
          <h2 className="text-lg font-bold">{t("home.provider_cta_title")}</h2>
          <p className="mt-2 text-ink">{t("home.provider_cta_text")}</p>
          <LinkButton href={href(locale, "/dienstverlener-worden")} variant="secondary" className="mt-4">
            {t("home.provider_cta")}
          </LinkButton>
        </Card>
      </section>
    </div>
  );
}
