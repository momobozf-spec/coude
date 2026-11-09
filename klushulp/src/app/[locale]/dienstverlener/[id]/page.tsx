import { notFound } from "next/navigation";
import { localeFromParams, href, formatDate } from "@/lib/locale";
import { getPublicProvider } from "@/lib/services/providers";
import { pick } from "@/i18n";
import { formatCents } from "@/lib/money";
import { Card, Empty, LinkButton, SectionTitle } from "@/components/ui";
import { ProviderHeader } from "@/components/proposal-card";

export default async function ProviderProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { id } = await params;
  const data = await getPublicProvider(id);
  if (!data) notFound();
  const { provider, categories, reviews, stats } = data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Card className="space-y-4">
        <ProviderHeader provider={provider} stats={stats} locale={locale} t={t} />
        <p className="text-sm text-muted">
          {provider.baseMunicipality} · {t("prof.radius")}: {provider.radiusKm} km
          {provider.hourlyRateCents != null && ` · ${t("prof.hourly_rate")}: ${formatCents(provider.hourlyRateCents, locale)}`}
          {provider.travelFeeCents > 0 && ` · ${t("prof.travel_fee")}: ${formatCents(provider.travelFeeCents, locale)}`}
        </p>
        {provider.bio && (
          <div>
            <SectionTitle className="text-base">{t("browse.about")}</SectionTitle>
            <p className="mt-1 whitespace-pre-wrap">{provider.bio}</p>
          </div>
        )}
        <div>
          <SectionTitle className="text-base">{t("browse.services")}</SectionTitle>
          <ul className="mt-1 space-y-1 text-sm">
            {categories.map((c) => (
              <li key={c.category.id}>
                <strong>{pick(c.category, "name", locale)}</strong>
                {c.pc.services && ` — ${c.pc.services}`}
              </li>
            ))}
          </ul>
        </div>
        <LinkButton href={href(locale, `/aanvraag?voor=${provider.id}`)} full>
          {t("browse.request_to")}
        </LinkButton>
      </Card>
      <section className="space-y-3">
        <SectionTitle>{t("browse.profile_reviews")}</SectionTitle>
        {reviews.length === 0 ? (
          <Empty>{t("prop.no_reviews")}</Empty>
        ) : (
          reviews.map((r) => (
            <Card key={r.id} as="article">
              <p className="text-accent" aria-label={`${r.rating}/5`}>
                {"★".repeat(r.rating)}
                <span className="text-line-strong">{"★".repeat(5 - r.rating)}</span>
              </p>
              {r.body && <p className="mt-1 whitespace-pre-wrap">{r.body}</p>}
              <p className="mt-1 text-sm text-muted">
                {r.authorName} · {formatDate(r.createdAt, locale, { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
