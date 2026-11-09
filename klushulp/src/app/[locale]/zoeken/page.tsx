import type { Metadata } from "next";
import { localeFromParams, href } from "@/lib/locale";
import { getCategories, findMunicipality, getActiveRegions } from "@/lib/catalog";
import { searchProviders } from "@/lib/services/providers";
import { pick } from "@/i18n";
import { Button, Card, Empty, Input, Label, LinkButton, PageTitle, Select } from "@/components/ui";
import { ProviderHeader } from "@/components/proposal-card";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Dienstverleners" };

export default async function BrowsePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ c?: string; p?: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const sp = await searchParams;
  const [cats, regions] = await Promise.all([getCategories(), getActiveRegions()]);
  const cat = sp.c ? cats.find((c) => c.slug === sp.c) ?? null : null;
  const muni = sp.p && /^\d{4}$/.test(sp.p) ? await findMunicipality(sp.p) : null;
  const results = await searchProviders({ categoryId: cat?.id ?? null, lat: muni?.lat ?? null, lng: muni?.lng ?? null });
  const regionNames = regions.map((r) => pick(r, "name", locale)).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <PageTitle sub={t("browse.region_active", { region: regionNames })}>{t("browse.title")}</PageTitle>
      <form className="grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" method="get">
        <div>
          <Label htmlFor="c">{t("browse.filter_category")}</Label>
          <Select id="c" name="c" defaultValue={sp.c ?? ""}>
            <option value="">{t("cat.all")}</option>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug}>
                {pick(c, "name", locale)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="p">{t("browse.filter_postcode")}</Label>
          <Input id="p" name="p" inputMode="numeric" defaultValue={sp.p ?? ""} placeholder="2000" />
        </div>
        <Button type="submit" variant="secondary">
          {t("browse.search")}
        </Button>
      </form>

      {results.length === 0 ? (
        <Empty>
          <p>{t("browse.empty")}</p>
          <LinkButton href={href(locale, `/aanvraag${cat ? `?c=${cat.slug}` : ""}`)} className="mt-4">
            {t("nav.find_help")}
          </LinkButton>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <Card key={r.provider.id} as="li" className="space-y-3">
              <ProviderHeader provider={r.provider} stats={r.stats} locale={locale} t={t} link />
              <p className="text-sm text-muted">
                {r.categories.map((c) => pick(c.category, "name", locale)).join(" · ")}
                {r.distance != null && ` · ${t("browse.distance", { km: r.distance })}`}
                {r.provider.hourlyRateCents != null && ` · ${formatCents(r.provider.hourlyRateCents, locale)}/u`}
              </p>
              {r.provider.bio && <p className="line-clamp-2 text-sm">{r.provider.bio}</p>}
              <div className="flex flex-wrap gap-2">
                <LinkButton href={href(locale, `/dienstverlener/${r.provider.id}`)} variant="secondary">
                  {t("prop.view_profile")}
                </LinkButton>
                <LinkButton href={href(locale, `/aanvraag?voor=${r.provider.id}${sp.p ? `&p=${sp.p}` : ""}`)}>{t("browse.request_to")}</LinkButton>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
